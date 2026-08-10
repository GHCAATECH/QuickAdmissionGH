(function (global, document) {
  'use strict';

  // This list is generated from the application's existing event actions.
  // The dispatcher never evaluates arbitrary JavaScript from markup.
  const allowedActions = new Set([
    'addPlacement',
    'applyBulk',
    'applyFinancePaymentSearch',
    'applyVerifiedFilters',
    'bulkSms',
    'buyCredits',
    'caAssignSelected',
    'caAutoFill',
    'caRemove',
    'caToggle',
    'changeFinancePayPage',
    'changeManagePage',
    'changePlacementPage',
    'changeRegisteredPage',
    'changeVerificationPage',
    'changeVerifiedPage',
    'chooseAnotherLoginSchool',
    'clearSel',
    'clearVerificationSearch',
    'clearVerifiedFilters',
    'closeModal',
    'closePop',
    'closePortalClassSubjects',
    'closeReports',
    'confirmReverseVerification',
    'confirmVerifyStudent',
    'copyVerificationNumber',
    'createAdmin',
    'createSchool',
    'createUser',
    'delItem',
    'deleteAdmin',
    'deleteAllStudentRecords',
    'deletePlacement',
    'deletePlacementBatch',
    'deleteSchool',
    'deleteStudent',
    'deleteUser',
    'dismissPending',
    'dismissSubmissionSuccess',
    'doLogin',
    'docAdmissionLetter',
    'docProspectus',
    'docRecords',
    'docSubjects',
    'docUndertaking',
    'downloadAdmissionList',
    'downloadFinancePaymentsCSV',
    'downloadPlacementTemplate',
    'editAdmin',
    'editPlacement',
    'editSchool',
    'exportCSV',
    'exportEnrolmentAnalytics',
    'exportLargeAdmissionCsv',
    'exportVerifiedStudentsExcel',
    'exportVerifiedStudentsPdf',
    'filterLoginSchoolOptions',
    'filterSchoolPickerOptions',
    'genPass',
    'genPass2',
    'go',
    'goStep',
    'haAssignSelected',
    'haAutoAssignAll',
    'haAutoFill',
    'haRemove',
    'haToggle',
    'handleEnrFile',
    'handleLoginSchoolSearchKey',
    'handlePassportFile',
    'handlePlacementFile',
    'handleSchoolPickerSearchKey',
    'importPlacement',
    'insVar',
    'insertTplVar',
    'loadDefaultSmsTemplate',
    'loadManageStudentsPage',
    'loadTemplate',
    'loadTpl',
    'loadVerificationSearch',
    'logout',
    'onLoginSchoolChange',
    'onReligionChange',
    'onVerifiedProgrammeFilterChange',
    'onVerifiedResidentialFilterChange',
    'openAddSchool',
    'openClass',
    'openClassSubjects',
    'openCreateAdmin',
    'openCreateUser',
    'openFinanceReset',
    'openHouse',
    'openPop',
    'openPortalClassSubjects',
    'openProg',
    'openSchool',
    'openStudentUploadedFile',
    'openUserPerms',
    'openVerifiedStudentDetails',
    'openVerifyStudentModal',
    'payToken',
    'permToggleAll',
    'pickClass',
    'pickHouse',
    'pickSchoolPickerValue',
    'printFinancePayments',
    'printSchoolFinanceRequest',
    'printSettlementRequest',
    'printVerificationSlipById',
    'qaHandleSchoolLogoError',
    'qaOpenTplImagePicker',
    'qaSetAllUserPermissionChecks',
    'qaSetDocLineValue',
    'qaSetGeneratedAdminEditPassword',
    'qaToggleSchoolAdminPassword',
    'qaTplFormatAndReset',
    'queueManageSearch',
    'queueRegisteredSearch',
    'queueStudentFeatureSave',
    'queueVerificationSearch',
    'redirectToSelectedSchool',
    'refreshEditClassOptions',
    'refreshEditHouseOptions',
    'refreshFinanceResetPreview',
    'removeEnr',
    'renderArchives',
    'renderClassAlloc',
    'renderHouseAlloc',
    'renderSchools',
    'renderStudents',
    'repTab',
    'resetAdminPwd',
    'resetPassportUploadUi',
    'resetPlacementPage',
    'resetUserPwd',
    'restoreArchive',
    'retrieveToken',
    'retryVerify',
    'reverseVerificationById',
    'runReport',
    'saveAcademicConfig',
    'saveAdminEdit',
    'saveAnnouncement',
    'saveFinanceReset',
    'savePlacement',
    'savePortalSetup',
    'saveSchoolEdit',
    'saveSchoolProfile',
    'saveSmsSettings',
    'saveStudent',
    'saveUserPerms',
    'schoolTab',
    'sendBulkSms',
    'sendSms',
    'sendTestSms',
    'setupTab',
    'showPanel',
    'showScreen',
    'showVerificationSuccessById',
    'sortReg',
    'stepNext',
    'submitApp',
    'suspendSchool',
    'toast',
    'toggleAdmMenu',
    'toggleAdmission',
    'toggleAll',
    'toggleColumn',
    'toggleLoginSchoolPicker',
    'toggleNavGroup',
    'toggleOther',
    'toggleRegExpand',
    'toggleSb',
    'toggleSchoolPicker',
    'toggleSel',
    'toggleUserCreateMode',
    'tplCmd',
    'tplColor',
    'tplFont',
    'tplFull',
    'tplHilite',
    'tplInsertCrest',
    'tplInsertImage',
    'tplInsertLine',
    'tplInsertTextBox',
    'tplPreview',
    'tplSave',
    'tplSize',
    'tplTab',
    'updateSms',
    'updateSmsCount',
    'uploadEnr',
    'uploadPassportPhoto',
    'uploadSchoolCrest',
    'uploadSchoolDoc',
    'useNewToken',
    'useRetrieved',
    'viewStudent'
  ]);
  const supportedEvents = ['click', 'change', 'input', 'keydown'];

  function splitTopLevel(source, separator) {
    const parts = [];
    let current = '';
    let quote = '';
    let escaped = false;
    let depth = 0;

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (escaped) {
        current += character;
        escaped = false;
        continue;
      }
      if (quote && character === '\\') {
        current += character;
        escaped = true;
        continue;
      }
      if (quote) {
        current += character;
        if (character === quote) quote = '';
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
        current += character;
        continue;
      }
      if (character === '(' || character === '[' || character === '{') depth += 1;
      if (character === ')' || character === ']' || character === '}') depth -= 1;
      if (character === separator && depth === 0) {
        if (current.trim()) parts.push(current.trim());
        current = '';
        continue;
      }
      current += character;
    }
    if (current.trim()) parts.push(current.trim());
    return parts;
  }

  function parseQuotedString(token) {
    const quote = token[0];
    const body = token.slice(1, -1);
    let result = '';
    let escaped = false;
    for (let index = 0; index < body.length; index += 1) {
      const character = body[index];
      if (!escaped && character === '\\') {
        escaped = true;
        continue;
      }
      if (escaped) {
        const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v' };
        result += Object.prototype.hasOwnProperty.call(escapes, character) ? escapes[character] : character;
        escaped = false;
        continue;
      }
      result += character;
    }
    if (escaped) result += '\\';
    if (quote !== '"' && quote !== "'") throw new Error('Unsupported action string');
    return result;
  }

  function parseArgument(token, element, event) {
    const value = token.trim();
    if (!value) throw new Error('Empty action argument');
    const lastCharacter = value[value.length - 1];
    if ((value[0] === '"' && lastCharacter === '"') || (value[0] === "'" && lastCharacter === "'")) {
      return parseQuotedString(value);
    }
    if (/^-?(?:\d+\.?\d*|\.\d+)$/.test(value)) return Number(value);
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    if (value === 'this') return element;
    if (value === 'this.value') return element.value;
    if (value === 'event') return event;
    throw new Error(`Unsupported action argument: ${value}`);
  }

  function runStatement(statement, element, event) {
    const source = statement.trim();
    if (!source) return;

    let match = source.match(/^if\s*\(\s*event\.target\s*===\s*this\s*\)\s*(.+)$/s);
    if (match) {
      if (event.target === element) runProgram(match[1], element, event);
      return;
    }

    match = source.match(/^if\s*\(\s*event\.key\s*===\s*(["'])(.*?)\1\s*\)\s*(.+)$/s);
    if (match) {
      if (event.key === match[2]) runProgram(match[3], element, event);
      return;
    }

    if (source === 'event.stopPropagation()') {
      event.stopPropagation();
      return;
    }
    if (source === 'event.preventDefault()') {
      event.preventDefault();
      return;
    }

    match = source.match(/^([A-Za-z_$][\w$]*)\s*\(([\s\S]*)\)$/);
    if (!match) throw new Error(`Unsupported action statement: ${source}`);
    const actionName = match[1];
    const action = global[actionName];
    if (!allowedActions.has(actionName) || typeof action !== 'function') {
      throw new Error(`Blocked action: ${actionName}`);
    }
    const args = match[2].trim()
      ? splitTopLevel(match[2], ',').map((argument) => parseArgument(argument, element, event))
      : [];
    return action.apply(element, args);
  }

  function runProgram(program, element, event) {
    for (const statement of splitTopLevel(program, ';')) {
      runStatement(statement, element, event);
    }
  }

  function dispatch(event) {
    const attribute = `data-qa-on${event.type}`;
    let element = event.target instanceof Element ? event.target : null;
    while (element) {
      if (element.hasAttribute(attribute)) {
        try {
          runProgram(element.getAttribute(attribute) || '', element, event);
        } catch (error) {
          console.error('Blocked or invalid UI action.', error);
        }
        if (event.cancelBubble) return;
      }
      element = element.parentElement;
    }
  }

  supportedEvents.forEach((eventName) => document.addEventListener(eventName, dispatch));
  document.addEventListener('error', function (event) {
    const element = event.target instanceof Element ? event.target : null;
    if (!element || !element.hasAttribute('data-qa-onerror')) return;
    try {
      runProgram(element.getAttribute('data-qa-onerror') || '', element, event);
    } catch (error) {
      console.error('Blocked or invalid UI error action.', error);
    }
  }, true);

  global.qaHandleSchoolLogoError = function (image) {
    image.style.display = 'none';
    const fallback = document.getElementById('schCrestText');
    if (fallback) {
      fallback.style.display = '';
      fallback.textContent = 'AB';
    }
  };
})(window, document);
