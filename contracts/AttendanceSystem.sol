// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title AttendanceSystem
 * @notice Decentralized academic attendance with rotating ephemeral-key QR codes.
 * @dev Part A: isActive deactivation for teachers/students.
 *      Part B: Rotating 20-second QR windows signed by ephemeral key stored on-chain.
 *              ecrecover validates window index + session binding.
 */
contract AttendanceSystem {
    enum Role { NONE, ADMIN, TEACHER, STUDENT }

    struct Teacher {
        address wallet;
        string name;
        string department;
        bool isRegistered;
        bool isActive;
    }

    struct Student {
        address wallet;
        string enrollmentNo;
        string name;
        string department;
        bool isRegistered;
        bool isActive;
    }

    struct Subject {
        uint256 id;
        string name;
        string code;
        address teacher;
        bool isActive;
    }

    struct Session {
        uint256 sessionId;
        uint256 subjectId;
        address teacher;
        // ephemeralSigner: browser-generated keypair address, rotates QR every 20s
        address ephemeralSigner;
        uint256 startTime;
        uint256 expiryTime;
        bool isActive;
        uint256 totalPresent;
    }

    struct AttendanceRecord {
        uint256 sessionId;
        uint256 subjectId;
        string subjectName;
        string subjectCode;
        uint256 timestamp;
        address student;
    }

    uint256 public constant QR_WINDOW_SECONDS = 20;

    address public admin;
    bool public demoFallbackEnabled = true;

    mapping(address => Role) public roles;
    mapping(address => Teacher) public teachers;
    mapping(address => Student) public students;
    mapping(string => address) public enrollmentToAddress;

    address[] public teacherList;
    address[] public studentList;

    uint256 public nextSubjectId = 1;
    mapping(uint256 => Subject) public subjects;
    uint256[] public subjectList;
    mapping(uint256 => uint256) public subjectSessionCount;

    uint256 public nextSessionId = 1;
    mapping(uint256 => Session) public sessions;
    mapping(uint256 => uint256[]) public subjectSessions;
    mapping(uint256 => bytes32) public sessionDemoOtpHash;

    mapping(uint256 => mapping(address => bool)) public hasMarked;
    mapping(address => AttendanceRecord[]) private studentRecords;
    mapping(uint256 => address[]) public sessionPresentStudents;

    event TeacherRegistered(address indexed teacher, string name, string department);
    event TeacherDeactivated(address indexed teacher, string name);
    event StudentRegistered(address indexed student, string enrollmentNo, string name, string department);
    event StudentDeactivated(address indexed student, string enrollmentNo, string name);
    event SubjectCreated(uint256 indexed subjectId, string name, string code, address indexed teacher);
    event SubjectDeactivated(uint256 indexed subjectId, string code);
    event SessionStarted(uint256 indexed sessionId, uint256 indexed subjectId, address indexed teacher, uint256 expiryTime, address ephemeralSigner);
    event SessionEnded(uint256 indexed sessionId);
    event AttendanceMarked(uint256 indexed sessionId, uint256 indexed subjectId, address indexed student, uint256 timestamp);
    event DemoFallbackToggled(bool enabled);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only Admin can perform this action");
        _;
    }

    modifier onlyStudent() {
        require(roles[msg.sender] == Role.STUDENT, "Only registered Student can perform this action");
        require(students[msg.sender].isActive, "Student account has been deactivated");
        _;
    }

    constructor() {
        admin = msg.sender;
        roles[msg.sender] = Role.ADMIN;
    }

    // ==========================================
    // ADMIN FUNCTIONS
    // ==========================================

    function setDemoFallbackEnabled(bool _enabled) external onlyAdmin {
        demoFallbackEnabled = _enabled;
        emit DemoFallbackToggled(_enabled);
    }

    function registerTeacher(address _teacherAddr, string calldata _name, string calldata _department) external onlyAdmin {
        require(_teacherAddr != address(0), "Invalid wallet address");
        require(!teachers[_teacherAddr].isRegistered, "Teacher already registered");

        teachers[_teacherAddr] = Teacher({
            wallet: _teacherAddr,
            name: _name,
            department: _department,
            isRegistered: true,
            isActive: true
        });

        roles[_teacherAddr] = Role.TEACHER;
        teacherList.push(_teacherAddr);

        emit TeacherRegistered(_teacherAddr, _name, _department);
    }

    function removeTeacher(address _teacherAddr) external onlyAdmin {
        require(teachers[_teacherAddr].isRegistered, "Teacher not registered");
        require(teachers[_teacherAddr].isActive, "Teacher already deactivated");

        teachers[_teacherAddr].isActive = false;
        emit TeacherDeactivated(_teacherAddr, teachers[_teacherAddr].name);
    }

    function registerStudent(address _studentAddr, string calldata _enrollmentNo, string calldata _name, string calldata _department) external onlyAdmin {
        require(_studentAddr != address(0), "Invalid wallet address");
        require(!students[_studentAddr].isRegistered, "Student already registered");
        require(enrollmentToAddress[_enrollmentNo] == address(0), "Enrollment number already exists");

        students[_studentAddr] = Student({
            wallet: _studentAddr,
            enrollmentNo: _enrollmentNo,
            name: _name,
            department: _department,
            isRegistered: true,
            isActive: true
        });

        roles[_studentAddr] = Role.STUDENT;
        enrollmentToAddress[_enrollmentNo] = _studentAddr;
        studentList.push(_studentAddr);

        emit StudentRegistered(_studentAddr, _enrollmentNo, _name, _department);
    }

    function removeStudent(address _studentAddr) external onlyAdmin {
        require(students[_studentAddr].isRegistered, "Student not registered");
        require(students[_studentAddr].isActive, "Student already deactivated");

        students[_studentAddr].isActive = false;
        emit StudentDeactivated(_studentAddr, students[_studentAddr].enrollmentNo, students[_studentAddr].name);
    }

    function createSubject(string calldata _name, string calldata _code, address _teacherAddr) external onlyAdmin returns (uint256) {
        require(bytes(_name).length > 0, "Subject name required");
        require(teachers[_teacherAddr].isRegistered || _teacherAddr == admin, "Teacher must be registered");

        uint256 subId = nextSubjectId++;
        subjects[subId] = Subject({ id: subId, name: _name, code: _code, teacher: _teacherAddr, isActive: true });
        subjectList.push(subId);

        emit SubjectCreated(subId, _name, _code, _teacherAddr);
        return subId;
    }

    function removeSubject(uint256 _subjectId) external onlyAdmin {
        require(subjects[_subjectId].isActive, "Subject not active");
        subjects[_subjectId].isActive = false;
        emit SubjectDeactivated(_subjectId, subjects[_subjectId].code);
    }

    // ==========================================
    // TEACHER FUNCTIONS
    // ==========================================

    /**
     * @notice Start a session with an ephemeral public address.
     * @param _ephemeralSigner Browser-generated one-time address (no ETH, no private key on-chain).
     *        Teacher's browser signs (sessionId, windowIndex) with this key every 20 seconds.
     */
    function startSession(uint256 _subjectId, address _ephemeralSigner, uint256 _durationMinutes) external returns (uint256) {
        return startSessionWithDemoCode(_subjectId, _ephemeralSigner, _durationMinutes, "");
    }

    function startSessionWithDemoCode(uint256 _subjectId, address _ephemeralSigner, uint256 _durationMinutes, string memory _demoCode) public returns (uint256) {
        Subject memory sub = subjects[_subjectId];
        require(sub.isActive, "Subject does not exist or is inactive");
        require(sub.teacher == msg.sender || msg.sender == admin, "Only assigned subject teacher or admin can start session");
        require(teachers[msg.sender].isActive || msg.sender == admin, "Teacher account has been deactivated");
        require(_durationMinutes >= 1 && _durationMinutes <= 300, "Duration must be between 1 and 300 minutes");
        require(_ephemeralSigner != address(0), "Ephemeral signer required");

        uint256 sessId = nextSessionId++;
        uint256 expiry = block.timestamp + (_durationMinutes * 1 minutes);

        sessions[sessId] = Session({
            sessionId: sessId,
            subjectId: _subjectId,
            teacher: msg.sender,
            ephemeralSigner: _ephemeralSigner,
            startTime: block.timestamp,
            expiryTime: expiry,
            isActive: true,
            totalPresent: 0
        });

        sessionDemoOtpHash[sessId] = keccak256(abi.encodePacked(sessId, _demoCode));

        subjectSessions[_subjectId].push(sessId);
        subjectSessionCount[_subjectId]++;

        emit SessionStarted(sessId, _subjectId, msg.sender, expiry, _ephemeralSigner);
        return sessId;
    }

    function endSession(uint256 _sessionId) external {
        Session storage sess = sessions[_sessionId];
        require(sess.isActive, "Session already inactive");
        Subject memory sub = subjects[sess.subjectId];
        require(
            sess.teacher == msg.sender ||
            sub.teacher == msg.sender ||
            msg.sender == admin,
            "Only teacher and admin can end session"
        );

        sess.isActive = false;
        emit SessionEnded(_sessionId);
    }

    // ==========================================
    // STUDENT FUNCTIONS — Rotating QR (ecrecover)
    // ==========================================

    /**
     * @notice Mark attendance using a rotating 20-second QR signature.
     * @param _sessionId  Active session ID.
     * @param _windowIndex 20-second window index signed into the QR (= (now - startTime) / 20).
     * @param _signature  65-byte ECDSA signature of keccak256(sessionId, windowIndex) by ephemeralSigner.
     *
     * Valid windows: current OR previous (gives student up to ~40s leeway for scan lag).
     */
    function markAttendance(uint256 _sessionId, uint256 _windowIndex, bytes calldata _signature) external onlyStudent {
        Session storage sess = sessions[_sessionId];
        require(sess.isActive, "Session is not active");
        require(block.timestamp <= sess.expiryTime, "Session has expired");

        // Window validation: current or previous window accepted
        uint256 currentWindow = (block.timestamp - sess.startTime) / QR_WINDOW_SECONDS;
        require(
            _windowIndex == currentWindow || (_windowIndex + 1 == currentWindow && currentWindow > 0),
            "QR window has expired - rescan the teacher screen"
        );

        // Signature verification via ecrecover
        bytes32 messageHash = keccak256(abi.encodePacked(_sessionId, _windowIndex));
        bytes32 ethSignedHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        address recovered = _recoverSigner(ethSignedHash, _signature);
        require(recovered == sess.ephemeralSigner, "Invalid QR signature - wrong session or replayed code");

        require(!hasMarked[_sessionId][msg.sender], "Attendance already marked for this session");

        hasMarked[_sessionId][msg.sender] = true;
        sess.totalPresent++;
        sessionPresentStudents[_sessionId].push(msg.sender);

        Subject memory sub = subjects[sess.subjectId];
        studentRecords[msg.sender].push(AttendanceRecord({
            sessionId: _sessionId,
            subjectId: sess.subjectId,
            subjectName: sub.name,
            subjectCode: sub.code,
            timestamp: block.timestamp,
            student: msg.sender
        }));

        emit AttendanceMarked(_sessionId, sess.subjectId, msg.sender, block.timestamp);
    }

    /**
     * @notice Demo fallback: 6-digit string code (requires demoFallbackEnabled).
     *         Hash stored on-chain is keccak256(sessionId, demoCode) set at session start via startSessionDemo.
     */
    function markAttendanceWithCode(uint256 _sessionId, string calldata _demoCode) external onlyStudent {
        require(demoFallbackEnabled, "Demo 6-digit OTP fallback is currently disabled");
        Session storage sess = sessions[_sessionId];
        require(sess.isActive, "Session is not active");
        require(block.timestamp <= sess.expiryTime, "Session has expired");

        bytes32 codeHash = keccak256(abi.encodePacked(_sessionId, _demoCode));
        address expectedAddr = address(uint160(uint256(codeHash)));
        require(
            expectedAddr == sess.ephemeralSigner ||
            codeHash == sessionDemoOtpHash[_sessionId],
            "Invalid 6-digit demo OTP code"
        );

        require(!hasMarked[_sessionId][msg.sender], "Attendance already marked for this session");

        hasMarked[_sessionId][msg.sender] = true;
        sess.totalPresent++;
        sessionPresentStudents[_sessionId].push(msg.sender);

        Subject memory sub = subjects[sess.subjectId];
        studentRecords[msg.sender].push(AttendanceRecord({
            sessionId: _sessionId,
            subjectId: sess.subjectId,
            subjectName: sub.name,
            subjectCode: sub.code,
            timestamp: block.timestamp,
            student: msg.sender
        }));

        emit AttendanceMarked(_sessionId, sess.subjectId, msg.sender, block.timestamp);
    }

    // ==========================================
    // INTERNAL HELPERS
    // ==========================================

    function _recoverSigner(bytes32 _ethSignedHash, bytes calldata _signature) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");
        bytes32 r = bytes32(_signature[0:32]);
        bytes32 s = bytes32(_signature[32:64]);
        uint8 v = uint8(_signature[64]);
        if (v < 27) v += 27;
        return ecrecover(_ethSignedHash, v, r, s);
    }

    // ==========================================
    // VIEW / READ FUNCTIONS
    // ==========================================

    function getUserRole(address _user) external view returns (uint8) {
        return uint8(roles[_user]);
    }

    function getStudentByEnrollment(string calldata _enrollmentNo) external view returns (Student memory, address) {
        address addr = enrollmentToAddress[_enrollmentNo];
        require(addr != address(0), "Student with enrollment number not found");
        return (students[addr], addr);
    }

    function getStudentAttendanceHistory(address _studentAddr) external view returns (AttendanceRecord[] memory) {
        return studentRecords[_studentAddr];
    }

    function getSessionPresentStudents(uint256 _sessionId) external view returns (address[] memory) {
        return sessionPresentStudents[_sessionId];
    }

    function getAllSubjects() external view returns (Subject[] memory) {
        Subject[] memory result = new Subject[](subjectList.length);
        for (uint256 i = 0; i < subjectList.length; i++) {
            result[i] = subjects[subjectList[i]];
        }
        return result;
    }

    function getAllTeachers() external view returns (Teacher[] memory) {
        Teacher[] memory result = new Teacher[](teacherList.length);
        for (uint256 i = 0; i < teacherList.length; i++) {
            result[i] = teachers[teacherList[i]];
        }
        return result;
    }

    function getAllStudents() external view returns (Student[] memory) {
        Student[] memory result = new Student[](studentList.length);
        for (uint256 i = 0; i < studentList.length; i++) {
            result[i] = students[studentList[i]];
        }
        return result;
    }

    function getSubjectSessions(uint256 _subjectId) external view returns (uint256[] memory) {
        return subjectSessions[_subjectId];
    }

    function getSubjectAttendanceStats(uint256 _subjectId, address _studentAddr) external view returns (uint256 totalSessions, uint256 attendedSessions) {
        totalSessions = subjectSessionCount[_subjectId];
        uint256[] memory sessIds = subjectSessions[_subjectId];
        attendedSessions = 0;
        for (uint256 i = 0; i < sessIds.length; i++) {
            if (hasMarked[sessIds[i]][_studentAddr]) {
                attendedSessions++;
            }
        }
    }
}
