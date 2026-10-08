/**
 * Auth.gs
 * Quản lý người dùng, phân quyền Role theo CLAUDE.md Section 34 & DATABASE.md Section 4, 54
 * Các Role: ADMIN, BAI, GATE_IN, YARD, GATE_OUT
 */

var AuthService = (function() {

  /**
   * Lấy thông tin người dùng hiện tại đang đăng nhập.
   * Ưu tiên lấy từ Session Google Apps Script, kết hợp bảng USERS.
   */
  function getCurrentUser() {
    let email = '';
    try {
      email = Session.getActiveUser().getEmail();
    } catch (e) {}

    // Lấy danh sách users từ database
    let allUsers = [];
    try {
      allUsers = DatabaseService.readAll(SHEETS.USERS);
    } catch (e) {
      // Khi database chưa được init
    }

    if (email) {
      const found = allUsers.find(u => String(u.Email).toLowerCase() === email.toLowerCase());
      if (found) {
        if (found.Status === 'INACTIVE') {
          return {
            id: found.UserID,
            email: found.Email,
            name: found.FullName,
            role: 'INACTIVE',
            status: 'INACTIVE',
            isLoggedIn: false,
            message: 'Tài khoản của bạn đã bị vô hiệu hóa.'
          };
        }
        return {
          id: found.UserID,
          email: found.Email,
          name: found.FullName,
          role: found.Role,
          status: found.Status,
          isLoggedIn: true
        };
      }
    }

    // Nếu chạy chế độ nội bộ hoặc chưa gán email, lấy tài khoản ADMIN đầu tiên hoặc tạo profile tạm
    if (allUsers.length > 0) {
      const admin = allUsers.find(u => u.Role === ROLES.ADMIN) || allUsers[0];
      return {
        id: admin.UserID,
        email: admin.Email,
        name: admin.FullName,
        role: admin.Role,
        status: admin.Status,
        isLoggedIn: true
      };
    }

    // Mặc định fallback khi khởi chạy lần đầu
    return {
      id: 'USR-ADMIN-001',
      email: email || 'admin@dtk.local',
      name: 'Quản Trị Viên',
      role: ROLES.ADMIN,
      status: 'ACTIVE',
      isLoggedIn: true
    };
  }

  /**
   * Kiểm tra quyền truy cập của người dùng
   * @param {Array<string>|string} allowedRoles - Danh sách role được phép
   */
  function requireRole(allowedRoles) {
    const user = getCurrentUser();
    if (!user || !user.isLoggedIn || user.status !== 'ACTIVE') {
      throw new Error('Bạn chưa đăng nhập hoặc tài khoản đã bị khóa.');
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    // ADMIN luôn có toàn quyền theo CLAUDE.md Section 34
    if (user.role === ROLES.ADMIN || roles.indexOf(user.role) !== -1) {
      return user;
    }

    throw new Error('Bạn không có quyền thực hiện thao tác này. Quyền yêu cầu: ' + roles.join(', '));
  }

  /**
   * Lấy danh sách tất cả người dùng (Dành cho Admin)
   */
  function getAllUsers() {
    requireRole([ROLES.ADMIN]);
    return DatabaseService.readAll(SHEETS.USERS);
  }

  /**
   * Thêm hoặc cập nhật người dùng (Dành cho Admin)
   */
  function saveUser(userData) {
    requireRole([ROLES.ADMIN]);
    if (!userData || !userData.Email || !userData.FullName || !userData.Role) {
      return responseError('Vui lòng điền đầy đủ Email, Họ tên và Quyền hạn.', 'INVALID_DATA');
    }

    const allUsers = DatabaseService.readAll(SHEETS.USERS);
    const existing = allUsers.find(u => String(u.Email).toLowerCase() === String(userData.Email).toLowerCase());

    const nowStr = formatDateTime(new Date());
    const currentUser = getCurrentUser();

    if (userData.UserID || existing) {
      const targetId = userData.UserID || existing.UserID;
      DatabaseService.updateRow(SHEETS.USERS, 'UserID', targetId, {
        FullName: userData.FullName,
        Role: userData.Role,
        Status: userData.Status || 'ACTIVE',
        UpdatedAt: nowStr
      });
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', targetId, '', '', 'Cập nhật tài khoản: ' + userData.Email, currentUser);
      return responseSuccess('Cập nhật tài khoản thành công.');
    } else {
      const newUserId = generateId('USR');
      const newUser = {
        UserID: newUserId,
        Email: String(userData.Email).trim().toLowerCase(),
        FullName: userData.FullName,
        Role: userData.Role,
        Status: userData.Status || 'ACTIVE',
        CreatedAt: nowStr,
        UpdatedAt: nowStr
      };
      DatabaseService.insertRow(SHEETS.USERS, newUser);
      AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', newUserId, '', '', 'Tạo mới tài khoản: ' + userData.Email, currentUser);
      return responseSuccess('Tạo tài khoản mới thành công.');
    }
  }

  /**
   * Bật/tắt trạng thái người dùng
   */
  function toggleUserStatus(userId) {
    requireRole([ROLES.ADMIN]);
    const allUsers = DatabaseService.readAll(SHEETS.USERS);
    const user = allUsers.find(u => u.UserID === userId);
    if (!user) {
      return responseError('Không tìm thấy người dùng.', 'NOT_FOUND');
    }

    const newStatus = user.Status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    DatabaseService.updateRow(SHEETS.USERS, 'UserID', userId, {
      Status: newStatus,
      UpdatedAt: formatDateTime(new Date())
    });

    AuditService.writeLog(AUDIT_ACTIONS.UPDATE, 'USER', userId, user.Status, newStatus, 'Chuyển trạng thái người dùng thành ' + newStatus);
    return responseSuccess('Cập nhật trạng thái thành ' + newStatus);
  }

  return {
    getCurrentUser: getCurrentUser,
    requireRole: requireRole,
    getAllUsers: getAllUsers,
    saveUser: saveUser,
    toggleUserStatus: toggleUserStatus
  };

})();
