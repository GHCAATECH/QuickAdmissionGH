document.addEventListener('DOMContentLoaded',function(){
      var currentYear=document.getElementById('currentYear');
      if(currentYear) currentYear.textContent=new Date().getFullYear();
      var tokenInput=document.getElementById('login-token');
      var togglePassword=document.getElementById('togglePassword');
      if(tokenInput&&togglePassword){
        togglePassword.addEventListener('click',function(){
          var isPassword=tokenInput.type==='password';
          tokenInput.type=isPassword?'text':'password';
          togglePassword.textContent=isPassword?'Hide':'Show';
          togglePassword.setAttribute('aria-label',isPassword?'Hide admission token':'Show admission token');
        });
      }
      var tutorialModal=document.getElementById('tutorialModal');
      var openButtons=document.querySelectorAll('.open-tutorial');
      var closeButton=document.getElementById('closeTutorialModal');
      var overlay=tutorialModal?tutorialModal.querySelector('[data-close-tutorial]'):null;
      var lastFocusedElement=null;
      function openTutorialModal(){
        if(!tutorialModal)return;
        lastFocusedElement=document.activeElement;
        tutorialModal.classList.add('is-open');
        tutorialModal.setAttribute('aria-hidden','false');
        document.body.classList.add('modal-open');
        if(closeButton) closeButton.focus();
      }
      function closeTutorialModal(){
        if(!tutorialModal)return;
        tutorialModal.classList.remove('is-open');
        tutorialModal.setAttribute('aria-hidden','true');
        document.body.classList.remove('modal-open');
        if(lastFocusedElement) lastFocusedElement.focus();
      }
      openButtons.forEach(function(button){button.addEventListener('click',openTutorialModal);});
      if(closeButton) closeButton.addEventListener('click',closeTutorialModal);
      if(overlay) overlay.addEventListener('click',closeTutorialModal);
      document.addEventListener('keydown',function(event){
        if(event.key==='Escape'&&tutorialModal&&tutorialModal.classList.contains('is-open')) closeTutorialModal();
      });
    });
