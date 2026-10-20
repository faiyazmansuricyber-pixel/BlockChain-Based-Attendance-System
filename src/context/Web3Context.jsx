import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../utils/contractConfig';

const Web3Context = createContext();

export const Web3Provider = ({ children }) => {
  const [account, setAccount] = useState(null);
  const [role, setRole] = useState(0); // 0: None/Guest, 1: Admin, 2: Teacher, 3: Student
  const [roleName, setRoleName] = useState('Guest');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [eventsFeed, setEventsFeed] = useState([]);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [latestBlockNumber, setLatestBlockNumber] = useState(null);
  const [contractNotFound, setContractNotFound] = useState(false);
  const [chainId, setChainId] = useState(null);
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);

  // Toast Helper Refs for strict deduplication
  const lastToastMsgRef  = useRef('');
  const lastToastTimeRef = useRef(0);
  const toastTimerRef    = useRef(null);

  // Network Switch Helper for Hardhat Local (Chain ID: 31337 / 0x7A69)
  const ensureHardhatNetwork = async () => {
    if (!window.ethereum) return false;
    try {
      const netHex = await window.ethereum.request({ method: 'eth_chainId' });
      const currentChainIdNum = parseInt(netHex, 16);
      setChainId(currentChainIdNum);

      if (currentChainIdNum !== 31337) {
        setIsWrongNetwork(true);
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x7A69' }], // 31337 in hex
          });
          setIsWrongNetwork(false);
          setChainId(31337);
          return true;
        } catch (switchError) {
          if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
            try {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x7A69',
                  chainName: 'Hardhat Localhost',
                  rpcUrls: ['http://127.0.0.1:8545'],
                  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                }],
              });
              setIsWrongNetwork(false);
              setChainId(31337);
              return true;
            } catch (addError) {
              console.error('Failed to add Hardhat network:', addError);
              addToast('Please switch MetaMask network to Hardhat Local (Chain ID: 31337)', 'warning');
              return false;
            }
          } else {
            console.error('Failed to switch network:', switchError);
            addToast('Please switch MetaMask network to Hardhat Local (Chain ID: 31337)', 'warning');
            return false;
          }
        }
      } else {
        setIsWrongNetwork(false);
        return true;
      }
    } catch (err) {
      console.error('Error in ensureHardhatNetwork:', err);
      return false;
    }
  };

  const checkContractDeployed = async (ethProvider) => {
    if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === "" || CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000") {
      setContractNotFound(true);
      setContract(null);
      return false;
    }
    try {
      const code = await ethProvider.getCode(CONTRACT_ADDRESS);
      if (!code || code === '0x' || code === '0x0') {
        console.warn(`No contract bytecode found at ${CONTRACT_ADDRESS} on active chain.`);
        setContractNotFound(true);
        setContract(null);
        return false;
      }
      setContractNotFound(false);
      return true;
    } catch (err) {
      console.error('Error checking contract code:', err);
      setContractNotFound(true);
      setContract(null);
      return false;
    }
  };

  // Toast Helper - Only one toast per event: dedupe identical messages, clear old ones
  const addToast = (message, type = 'info', txHash = null) => {
    if (!message) return;
    const now = Date.now();
    if (lastToastMsgRef.current === message && now - lastToastTimeRef.current < 3000) {
      return;
    }
    lastToastMsgRef.current = message;
    lastToastTimeRef.current = now;

    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);

    const id = now;
    setToasts([{ id, message, type, txHash }]);

    toastTimerRef.current = setTimeout(() => {
      setToasts([]);
    }, 4500);
  };

  const removeToast = id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Initialize Web3 Connection
  const initWeb3 = useCallback(async () => {
    setLoading(true);
    setNetworkError(null);
    try {
      let ethProvider;
      if (window.ethereum) {
        ethProvider = new ethers.BrowserProvider(window.ethereum);
        try {
          const net = await ethProvider.getNetwork();
          const currentChainNum = Number(net.chainId);
          setChainId(currentChainNum);
          setIsWrongNetwork(currentChainNum !== 31337);
        } catch (netErr) {}
      } else {
        ethProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        setChainId(31337);
        setIsWrongNetwork(false);
      }

      setProvider(ethProvider);

      try {
        const blockNum = await ethProvider.getBlockNumber();
        setLatestBlockNumber(blockNum);
      } catch (e) {}

      if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const activeSigner = await ethProvider.getSigner();
          setAccount(accounts[0]);
          setSigner(activeSigner);
          await loadContractAndRole(accounts[0], ethProvider, activeSigner);
        } else {
          await loadReadOnlyContract(ethProvider);
        }
      } else {
        await loadReadOnlyContract(ethProvider);
      }

      // Fetch hardhat local accounts for demo switching
      try {
        const localProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
        const signers = await localProvider.listAccounts();
        if (signers && signers.length > 0) {
          setDemoAccounts(signers.map(s => s.address));
        }
      } catch (err) {}

    } catch (err) {
      console.error('Web3 initialization error:', err);
      setNetworkError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadContractAndRole = async (userAddress, ethProvider, activeSigner) => {
    try {
      const isDeployed = await checkContractDeployed(ethProvider);
      if (!isDeployed) return;

      const contractInst = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        activeSigner || ethProvider
      );
      setContract(contractInst);

      const userRoleNum = await contractInst.getUserRole(userAddress);
      const roleVal = Number(userRoleNum);
      setRole(roleVal);

      const rolesArr = ['Guest', 'Admin', 'Teacher', 'Student'];
      setRoleName(rolesArr[roleVal] || 'Guest');
    } catch (err) {
      console.error('Error loading contract and role:', err);
    }
  };

  const loadReadOnlyContract = async (ethProvider) => {
    try {
      const isDeployed = await checkContractDeployed(ethProvider);
      if (!isDeployed) return;

      const contractInst = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        ethProvider
      );
      setContract(contractInst);
    } catch (err) {
      console.error('Error loading read-only contract:', err);
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      addToast('MetaMask is not installed. Using local read-only provider.', 'warning');
      return;
    }
    try {
      setLoading(true);
      await ensureHardhatNetwork();
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        const net = await ethProvider.getNetwork();
        const activeChainId = Number(net.chainId);
        setChainId(activeChainId);
        setIsWrongNetwork(activeChainId !== 31337);

        const activeSigner = await ethProvider.getSigner();
        setAccount(accounts[0]);
        setSigner(activeSigner);
        setProvider(ethProvider);
        await loadContractAndRole(accounts[0], ethProvider, activeSigner);
        addToast(`Wallet connected: ${accounts[0].substring(0, 6)}...${accounts[0].substring(38)}`, 'success');
      }
    } catch (err) {
      console.error('Wallet connection rejected:', err);
      addToast(err.message || 'Failed to connect wallet', 'error');
    } finally {
      setLoading(false);
    }
  };

  const switchDemoAccount = async (targetAddress) => {
    try {
      setLoading(true);
      // Demo Mode: ALWAYS use direct JsonRpcProvider to http://127.0.0.1:8545, ignoring MetaMask
      const localProvider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
      const activeSigner = await localProvider.getSigner(targetAddress);
      setAccount(targetAddress);
      setSigner(activeSigner);
      setProvider(localProvider);
      setChainId(31337);
      setIsWrongNetwork(false);
      await loadContractAndRole(targetAddress, localProvider, activeSigner);
      addToast(`Switched demo account to: ${targetAddress.substring(0, 6)}...`, 'success');
    } catch (err) {
      console.error('Failed to switch demo account:', err);
      addToast(`Demo account switch failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Block Poller
  useEffect(() => {
    if (!provider) return;
    const interval = setInterval(async () => {
      try {
        const blockNum = await provider.getBlockNumber();
        setLatestBlockNumber(blockNum);
      } catch (e) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [provider]);

  // Event Listeners with Strict Deduplication
  useEffect(() => {
    if (!contract || !provider) return;

    const handleAttendanceMarked = async (sessionId, subjectId, student, timestamp, event) => {
      const txHash = event?.log?.transactionHash || event?.transactionHash || null;
      let stName = student;
      try {
        const stStruct = await contract.students(student);
        if (stStruct && stStruct.isRegistered) {
          stName = `${stStruct.name} (${stStruct.enrollmentNo})`;
        }
      } catch (e) {}

      const newEvent = {
        type: 'AttendanceMarked',
        title: 'Attendance Marked On-Chain',
        sessionId: Number(sessionId),
        subjectId: Number(subjectId),
        student: stName,
        studentAddr: student,
        timestamp: Number(timestamp),
        txHash: txHash,
      };

      setEventsFeed(prev => {
        if (prev.some(e => (txHash && e.txHash === txHash) || (e.sessionId === newEvent.sessionId && e.studentAddr?.toLowerCase() === newEvent.studentAddr?.toLowerCase()))) {
          return prev;
        }
        return [newEvent, ...prev.slice(0, 19)];
      });
    };

    const handleSessionStarted = (sessionId, subjectId, teacher, expiryTime, event) => {
      const txHash = event?.log?.transactionHash || event?.transactionHash || null;
      const newEvent = {
        type: 'SessionStarted',
        title: 'Class Session Launched',
        sessionId: Number(sessionId),
        subjectId: Number(subjectId),
        teacher,
        expiryTime: Number(expiryTime),
        txHash: txHash,
      };

      setEventsFeed(prev => {
        if (prev.some(e => (txHash && e.txHash === txHash) || (e.sessionId === newEvent.sessionId && e.type === 'SessionStarted'))) {
          return prev;
        }
        return [newEvent, ...prev.slice(0, 19)];
      });
    };

    try {
      contract.removeAllListeners('AttendanceMarked');
      contract.removeAllListeners('SessionStarted');

      contract.on('AttendanceMarked', handleAttendanceMarked);
      contract.on('SessionStarted', handleSessionStarted);
    } catch (e) {}

    return () => {
      try {
        contract.removeAllListeners('AttendanceMarked');
        contract.removeAllListeners('SessionStarted');
      } catch (e) {}
    };
  }, [contract, provider]);

  useEffect(() => {
    initWeb3();
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accs) => {
        if (accs.length > 0) initWeb3();
        else { setAccount(null); setRole(0); setRoleName('Guest'); }
      });
      window.ethereum.on('chainChanged', () => window.location.reload());
    }
  }, [initWeb3]);

  return (
    <Web3Context.Provider
      value={{
        account,
        role,
        roleName,
        provider,
        signer,
        contract,
        loading,
        networkError,
        toasts,
        addToast,
        removeToast,
        connectWallet,
        switchDemoAccount,
        eventsFeed,
        demoAccounts,
        latestBlockNumber,
        contractNotFound,
        chainId,
        isWrongNetwork,
        ensureHardhatNetwork,
        refreshRole: () => account && loadContractAndRole(account, provider, signer),
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
