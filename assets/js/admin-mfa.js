(function (global) {
  'use strict';

  function messageFrom(error, fallback) {
    return error && error.message ? String(error.message) : fallback;
  }

  function factorList(data) {
    if (!data) return [];
    if (Array.isArray(data.totp)) return data.totp;
    if (data.all && Array.isArray(data.all)) {
      return data.all.filter(function (factor) { return factor.factor_type === 'totp'; });
    }
    return [];
  }

  function removeDialog() {
    var current = document.getElementById('qaAdminMfaDialog');
    if (current) current.remove();
  }

  function openDialog(options) {
    removeDialog();
    return new Promise(function (resolve, reject) {
      var overlay = document.createElement('div');
      overlay.id = 'qaAdminMfaDialog';
      overlay.className = 'qa-mfa-overlay';
      overlay.innerHTML =
        '<section class="qa-mfa-card" role="dialog" aria-modal="true" aria-labelledby="qaMfaTitle">' +
          '<div class="qa-mfa-shield" aria-hidden="true">MFA</div>' +
          '<h2 id="qaMfaTitle"></h2>' +
          '<p id="qaMfaCopy" class="qa-mfa-copy"></p>' +
          '<div id="qaMfaEnrollment" class="qa-mfa-enrollment" hidden>' +
            '<img id="qaMfaQr" alt="Authenticator setup QR code">' +
            '<div class="qa-mfa-secret-wrap"><span>Manual setup key</span><code id="qaMfaSecret"></code></div>' +
          '</div>' +
          '<form id="qaMfaForm" novalidate>' +
            '<label for="qaMfaCode">Six-digit authentication code</label>' +
            '<input id="qaMfaCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}" placeholder="000000" required>' +
            '<div id="qaMfaError" class="qa-mfa-error" role="alert" aria-live="polite"></div>' +
            '<button id="qaMfaVerify" type="submit">VERIFY AND CONTINUE</button>' +
            '<button id="qaMfaCancel" type="button" class="qa-mfa-cancel">CANCEL AND SIGN OUT</button>' +
          '</form>' +
        '</section>';

      document.body.appendChild(overlay);
      var title = overlay.querySelector('#qaMfaTitle');
      var copy = overlay.querySelector('#qaMfaCopy');
      var enrollment = overlay.querySelector('#qaMfaEnrollment');
      var qr = overlay.querySelector('#qaMfaQr');
      var secret = overlay.querySelector('#qaMfaSecret');
      var form = overlay.querySelector('#qaMfaForm');
      var code = overlay.querySelector('#qaMfaCode');
      var errorBox = overlay.querySelector('#qaMfaError');
      var verify = overlay.querySelector('#qaMfaVerify');
      var cancel = overlay.querySelector('#qaMfaCancel');

      title.textContent = options.enrolling ? 'Secure your admin account' : 'Two-step verification';
      copy.textContent = options.enrolling
        ? 'Scan this QR code with an authenticator app, then enter the six-digit code. This is required before the dashboard opens.'
        : 'Enter the current six-digit code from your authenticator app to continue.';

      if (options.enrolling) {
        enrollment.hidden = false;
        qr.src = options.qrCode;
        secret.textContent = options.secret;
      }

      function finishError(error) {
        verify.disabled = false;
        verify.textContent = 'VERIFY AND CONTINUE';
        errorBox.textContent = messageFrom(error, 'The authentication code could not be verified.');
        code.select();
      }

      form.addEventListener('submit', function (event) {
        event.preventDefault();
        var submitted = String(code.value || '').replace(/\D/g, '');
        if (!/^\d{6}$/.test(submitted)) {
          errorBox.textContent = 'Enter the complete six-digit code.';
          code.focus();
          return;
        }
        errorBox.textContent = '';
        verify.disabled = true;
        verify.textContent = 'VERIFYING...';
        Promise.resolve(options.verify(submitted)).then(function () {
          removeDialog();
          resolve(true);
        }).catch(finishError);
      });

      cancel.addEventListener('click', function () {
        removeDialog();
        var error = new Error('Multi-factor verification was cancelled.');
        error.code = 'mfa_cancelled';
        reject(error);
      });

      requestAnimationFrame(function () { code.focus(); });
    });
  }

  async function verifyFactor(client, factorId, code) {
    var challenge = await client.auth.mfa.challenge({ factorId: factorId });
    if (challenge.error || !challenge.data || !challenge.data.id) {
      throw challenge.error || new Error('Could not start the authentication challenge.');
    }
    var verified = await client.auth.mfa.verify({
      factorId: factorId,
      challengeId: challenge.data.id,
      code: code
    });
    if (verified.error) throw verified.error;
    return verified.data;
  }

  async function ensure(client) {
    if (!client || !client.auth || !client.auth.mfa) {
      throw new Error('Multi-factor authentication is unavailable. Reload the page and try again.');
    }

    var assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data && assurance.data.currentLevel === 'aal2') return true;

    var listed = await client.auth.mfa.listFactors();
    if (listed.error) throw listed.error;
    var factors = factorList(listed.data);
    var verifiedFactors = factors.filter(function (factor) { return factor.status === 'verified'; });

    if (verifiedFactors.length) {
      var factor = verifiedFactors[0];
      await openDialog({
        enrolling: false,
        verify: function (code) { return verifyFactor(client, factor.id, code); }
      });
    } else {
      var unverified = factors.filter(function (factor) { return factor.status !== 'verified'; });
      for (var i = 0; i < unverified.length; i += 1) {
        await client.auth.mfa.unenroll({ factorId: unverified[i].id });
      }

      var enrolled = await client.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'QuickAdmissionGH Admin'
      });
      if (enrolled.error || !enrolled.data || !enrolled.data.id || !enrolled.data.totp) {
        throw enrolled.error || new Error('Could not create an authenticator setup.');
      }

      try {
        await openDialog({
          enrolling: true,
          qrCode: enrolled.data.totp.qr_code,
          secret: enrolled.data.totp.secret,
          verify: function (code) { return verifyFactor(client, enrolled.data.id, code); }
        });
      } catch (error) {
        try { await client.auth.mfa.unenroll({ factorId: enrolled.data.id }); } catch (ignore) {}
        throw error;
      }
    }

    var confirmed = await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (confirmed.error || !confirmed.data || confirmed.data.currentLevel !== 'aal2') {
      throw confirmed.error || new Error('Multi-factor verification did not complete.');
    }
    return true;
  }

  global.QAAdminMFA = Object.freeze({ ensure: ensure, close: removeDialog });
})(window);
