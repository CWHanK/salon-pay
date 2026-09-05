/**
 * SalonFlow - 認證、登入與身分權限管理 (js/auth.js)
 */

// 切換登入 / 註冊 模式
function setAuthMode(isSignUp) {
  isAuthSignUpMode = isSignUp;
  const submitText = document.getElementById('auth-submit-text');
  const roleContainer = document.getElementById('auth-role-container');
  const keyContainer = document.getElementById('auth-secret-key-container');
  const emailLabel = document.getElementById('auth-email-label');
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');

  if (isAuthSignUpMode) {
    if (tabSignup) {
      tabSignup.className = 'py-2.5 rounded-xl transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    }
    if (tabLogin) {
      tabLogin.className = 'py-2.5 rounded-xl transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    }
    if (submitText) submitText.textContent = '註冊';
    if (roleContainer) roleContainer.classList.remove('hidden');
    if (emailLabel) emailLabel.textContent = '自訂帳號';

    const selectedRole = document.querySelector('input[name="auth-reg-role"]:checked')?.value || 'staff';
    onAuthRoleChange(selectedRole);
  } else {
    if (tabLogin) {
      tabLogin.className = 'py-2.5 rounded-xl transition bg-white text-slate-900 shadow-xs flex items-center justify-center gap-1.5';
    }
    if (tabSignup) {
      tabSignup.className = 'py-2.5 rounded-xl transition text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
    }
    if (submitText) submitText.textContent = '登入';
    if (roleContainer) roleContainer.classList.add('hidden');
    if (keyContainer) keyContainer.classList.add('hidden');
    if (emailLabel) emailLabel.textContent = '自訂帳號';
  }
  if (window.lucide) lucide.createIcons();
}

// 註冊時切換身分單選按鈕
function onAuthRoleChange(role) {
  const keyContainer = document.getElementById('auth-secret-key-container');
  const adminKeyInput = document.getElementById('auth-admin-key');
  if (role === 'admin') {
    if (keyContainer) keyContainer.classList.remove('hidden');
    if (adminKeyInput) adminKeyInput.required = true;
  } else {
    if (keyContainer) keyContainer.classList.add('hidden');
    if (adminKeyInput) {
      adminKeyInput.required = false;
      adminKeyInput.value = '';
    }
  }
}

// 提交登入/註冊表單
async function handleAuthSubmit(e) {
  e.preventDefault();
  const rawInput = document.getElementById('auth-email').value.trim();
  const email = formatUsernameToEmail(rawInput);
  const password = document.getElementById('auth-password').value;
  const submitBtn = document.getElementById('auth-submit-btn');

  hideAuthError();
  submitBtn.disabled = true;
  submitBtn.classList.add('opacity-75');

  try {
    if (isAuthSignUpMode) {
      const selectedRole = document.querySelector('input[name="auth-reg-role"]:checked')?.value || 'staff';

      // 若註冊為管理員，取得授權密鑰之安全雜湊
      let adminKeyHash = null;
      if (selectedRole === 'admin') {
        const inputKey = (document.getElementById('auth-admin-key')?.value || '').trim();
        if (!inputKey) {
          throw new Error('請輸入管理員授權密鑰！若您是一般員工，請切換身分為「員工」註冊。');
        }
        adminKeyHash = await hashSecretKey(inputKey);
      }

      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);

      // 將註冊資料寫入全店 salon_users 集合 (由 Firestore 安全規則比對 adminKeyHash)
      await db.collection('salon_users').doc(cred.user.uid).set({
        uid: cred.user.uid,
        email: email,
        username: formatEmailToUsername(email),
        role: selectedRole,
        adminKeyHash: adminKeyHash,
        createdAt: new Date().toISOString()
      });

      showToast(`註冊成功！身分：${selectedRole === 'admin' ? '管理員' : '員工'}`);
    } else {
      try {
        await firebase.auth().signInWithEmailAndPassword(email, password);
      } catch (signInErr) {
        // 若以自訂帳號登入且報找不到帳號 (auth/user-not-found)，但未輸入 @
        // 嘗試在本地快取中檢查是否有符合此帳號前綴的舊 Email (例如 csli08159 -> csli08159@gmail.com)
        if (signInErr.code === 'auth/user-not-found' && !rawInput.includes('@')) {
          let legacyEmail = null;
          try {
            const cachedData = localStorage.getItem('SALON_PAY_LOCAL_CACHE');
            if (cachedData) {
              const parsed = JSON.parse(cachedData);
              if (parsed && Array.isArray(parsed.staff)) {
                const found = parsed.staff.find(s => 
                  s.linkedEmail && 
                  s.linkedEmail.includes('@') && 
                  s.linkedEmail.split('@')[0].toLowerCase() === rawInput.toLowerCase()
                );
                if (found) legacyEmail = found.linkedEmail;
              }
            }
          } catch (_) {}

          if (legacyEmail) {
            await firebase.auth().signInWithEmailAndPassword(legacyEmail, password);
          } else {
            throw signInErr;
          }
        } else {
          throw signInErr;
        }
      }
      showToast('登入成功！已連線至雲端');
    }
  } catch (err) {
    console.error('Auth error:', err);
    let msg = '認證失敗：' + err.message;
    if (err.code === 'auth/wrong-password') msg = '密碼輸入錯誤，請重新確認。';
    if (err.code === 'auth/user-not-found') msg = '此帳號尚未註冊，請切換至「註冊」建立新帳號。';
    if (err.code === 'auth/email-already-in-use') msg = '此帳號已被註冊，請直接登入。';
    if (err.code === 'auth/weak-password') msg = '密碼強度不足，請輸入至少 6 位字元。';
    if (err.code === 'auth/invalid-email') msg = '帳號格式不正確，請使用英文字母或數字。';
    showAuthError(msg);
  } finally {
    submitBtn.disabled = false;
    submitBtn.classList.remove('opacity-75');
  }
}

// 使用者成功登入之回呼
async function onUserLoggedIn(user) {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.add('hidden');

  // 取得該使用者的角色權限
  let role = 'staff';
  try {
    const userDoc = await db.collection('salon_users').doc(user.uid).get();
    if (userDoc.exists) {
      role = userDoc.data().role || 'staff';
    }

    // 創始帳號（帳號含 hank）永久確保為管理員
    const displayAccount = formatEmailToUsername(user.email).toLowerCase();
    const isHank = displayAccount.includes('hank');
    if (isHank) {
      role = 'admin';
    }

    await db.collection('salon_users').doc(user.uid).set({
      uid: user.uid,
      email: user.email,
      username: formatEmailToUsername(user.email),
      role: role,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch(e) {
    console.warn('載入使用者角色時發生錯誤:', e);
  }

  currentUserRole = role;
  applyRolePermissions();
  subscribeToCloudData();

  if (currentUserRole === 'admin') {
    subscribeToUsersList();
  }
}

// 使用者登出之回呼
function onUserLoggedOut() {
  if (unsubscribeFirestore) {
    unsubscribeFirestore();
    unsubscribeFirestore = null;
  }
  if (unsubscribeUsersList) {
    unsubscribeUsersList();
    unsubscribeUsersList = null;
  }
  currentUser = null;
  currentLinkedStaff = null;
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.classList.remove('hidden');
}

// 登出按鈕
async function handleSignOut() {
  if (!confirm('確定要登出系統嗎？')) return;
  if (firebase.auth) {
    await firebase.auth().signOut();
  }
  showToast('已登出');
}

function showAuthError(msg) {
  const box = document.getElementById('auth-error-msg');
  const text = document.getElementById('auth-error-text');
  if (box && text) {
    text.textContent = msg;
    box.classList.remove('hidden');
  }
}

function hideAuthError() {
  const box = document.getElementById('auth-error-msg');
  if (box) box.classList.add('hidden');
}

// 套用當前角色之介面權限 (模式 C 嚴格隔離)
function applyRolePermissions() {
  document.body.classList.remove('role-admin', 'role-staff');
  document.body.classList.add(`role-${currentUserRole}`);

  updateLinkedStaff();

  const userEmail = currentUser ? currentUser.email : '';
  const displayAccount = formatEmailToUsername(userEmail);
  const staffName = currentLinkedStaff ? currentLinkedStaff.name : displayAccount;

  // 頂部狀態標籤
  const headerEmail = document.getElementById('header-user-email');
  if (headerEmail) {
    if (currentUserRole === 'admin') {
      headerEmail.innerHTML = `管理員 <span class="font-bold text-slate-800">(${displayAccount})</span>`;
    } else {
      headerEmail.innerHTML = `員工 <span class="font-bold text-slate-800">(${staffName})</span>`;
    }
  }

  // 員工設定頁卡片
  const empName = document.getElementById('settings-employee-name');
  const empEmail = document.getElementById('settings-employee-email');
  const empCard = document.getElementById('settings-employee-card');
  if (empCard) {
    if (currentUserRole === 'staff') empCard.classList.remove('hidden');
    else empCard.classList.add('hidden');
  }
  if (empName) empName.textContent = currentLinkedStaff ? currentLinkedStaff.name : `店內人員 (${displayAccount})`;
  if (empEmail) empEmail.textContent = `登入帳號: ${displayAccount}`;

  // 管理員設定頁卡片
  const adminName = document.getElementById('settings-admin-name');
  const adminEmail = document.getElementById('settings-admin-email');
  const adminCard = document.getElementById('settings-admin-card');
  if (adminCard) {
    if (currentUserRole === 'admin') adminCard.classList.remove('hidden');
    else adminCard.classList.add('hidden');
  }
  if (adminName) adminName.textContent = currentLinkedStaff ? `${currentLinkedStaff.name} (店家管理員)` : `店家管理員 (${displayAccount})`;
  if (adminEmail) adminEmail.textContent = `登入帳號: ${displayAccount}`;

  // 桌面導覽列設定標籤文字
  const tabSettingsBtn = document.getElementById('tab-btn-settings');
  if (tabSettingsBtn) {
    tabSettingsBtn.innerHTML = currentUserRole === 'staff'
      ? '<i data-lucide="sliders" class="w-4 h-4"></i> 帳號設定'
      : '<i data-lucide="sliders" class="w-4 h-4"></i> 服務項目與人員管理';
  }

  if (window.lucide) lucide.createIcons();
}

// 管理員在名冊中切換使用者權限
async function toggleUserRole(uid, newRole) {
  if (currentUserRole !== 'admin') {
    alert('僅管理員有調整身分權限！');
    return;
  }
  if (!confirm(`確定要將該帳號身分調整為「${newRole === 'admin' ? '管理員' : '員工'}」嗎？`)) return;
  try {
    await db.collection('salon_users').doc(uid).update({ role: newRole });
    showToast(`已成功將身分更新為 ${newRole === 'admin' ? '管理員' : '員工'}`);
  } catch(e) {
    alert('身分更新失敗：' + e.message);
  }
}

// 員工憑密鑰將自身帳號升級為管理員
async function upgradeSelfToAdmin() {
  if (currentUserRole === 'admin') {
    alert('您目前已是管理員身分！');
    return;
  }
  if (!currentUser || !db) {
    alert('尚未連線或未登入！');
    return;
  }

  const keyInput = document.getElementById('upgrade-admin-key-input');
  const inputKey = (keyInput?.value || '').trim();

  if (!inputKey) {
    alert('請輸入店家管理員授權密鑰！');
    keyInput?.focus();
    return;
  }

  const inputHash = await hashSecretKey(inputKey);

  try {
    await db.collection('salon_users').doc(currentUser.uid).set({
      role: 'admin',
      adminKeyHash: inputHash,
      email: currentUser.email || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    currentUserRole = 'admin';

    // 清空密鑰輸入框
    if (keyInput) keyInput.value = '';

    applyRolePermissions();
    subscribeToUsersList();
    populateStaffDropdowns();
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();

    showToast('🎉 身分已成功升級為「店家管理員」！');
  } catch (err) {
    console.error('升級失敗:', err);
    alert('升級管理員失敗：授權密鑰不正確，請重新確認！');
  }
}

// 管理員將自身帳號降級為員工
async function demoteSelfToStaff() {
  if (currentUserRole !== 'admin') {
    alert('您目前並非管理員身分！');
    return;
  }
  if (!currentUser || !db) return;

  const otherAdmins = allRegisteredUsers.filter(u => u.uid !== currentUser.uid && u.role === 'admin');
  let confirmMsg = '確定要將自己的帳號降級為「員工」身分嗎？\n\n降級後您將轉為員工模式，僅能開單與查閱個人歷史紀錄，無法再進入月薪結算與後台管理。';
  if (otherAdmins.length === 0) {
    confirmMsg += '\n\n⚠️ 提醒：店內名單中目前無其他管理員帳號，降級後若需恢復管理權限，需由其他管理員在後台指定或於資料庫調整。';
  }

  if (!confirm(confirmMsg)) return;

  try {
    await db.collection('salon_users').doc(currentUser.uid).set({
      role: 'staff',
      email: currentUser.email || '',
      updatedAt: new Date().toISOString()
    }, { merge: true });

    currentUserRole = 'staff';

    applyRolePermissions();
    populateStaffDropdowns();
    filterHistoryOrders();
    calculateMonthlyPayroll();
    renderSettingsTables();

    showToast('已成功將自身帳號降級為「員工」身分！');
  } catch (err) {
    console.error('降級失敗:', err);
    alert('降級身分失敗：' + err.message);
  }
}

// 離線降級本機快取備案
function loadLocalFallback() {
  const raw = localStorage.getItem('SALON_PAY_LOCAL_CACHE');
  if (raw) {
    try {
      appState = sanitizeOldMockData(JSON.parse(raw));
    } catch(e) {}
  } else {
    appState = {
      services: [...DEFAULT_SERVICES],
      staff: [],
      orders: []
    };
  }
  applyRolePermissions();
  populateStaffDropdowns();
  initBillingForm();
  initHistoryFilters();
  initMonthlyView();
  renderSettingsTables();
}
