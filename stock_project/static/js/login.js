


function initLogin() {
    console.log("StockVision AI: Login controller script init success.");
    
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const passwordToggle = document.getElementById('passwordToggle');
    const toggleIcon = document.getElementById('toggleIcon');
    const loginError = document.getElementById('loginError');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('submitBtn');

    if (!loginForm) {
        console.error("StockVision AI: Could not find loginForm element in DOM!");
        return;
    }

  
    if (passwordToggle) {
        passwordToggle.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
          
            if (type === 'text') {
                toggleIcon.setAttribute('data-lucide', 'eye-off');
            } else {
                toggleIcon.setAttribute('data-lucide', 'eye');
            }
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
        });
    }


    const clearError = () => {
        loginError.classList.add('hidden');
    };
    if (usernameInput) usernameInput.addEventListener('input', clearError);
    if (passwordInput) passwordInput.addEventListener('input', clearError);


    loginForm.addEventListener('submit', async (e) => {
    
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        console.log(`StockVision AI: Intercepted form submission for user [${username}]`);

    
        submitBtn.disabled = true;
        submitBtn.querySelector('span').innerText = 'Verifying Authenticity...';

        try {
            console.log("StockVision AI: Sending POST request to /api/login...");
      
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            console.log(`StockVision AI: Received response status = ${response.status}`);
            const data = await response.json();
            console.log("StockVision AI: Parsed response JSON:", data);

            if (response.ok && data.success) {
                console.log("StockVision AI: Authentication successful! Setting localStorage token.");
            
                localStorage.setItem('stockvision_token', data.token);
                localStorage.setItem('stockvision_user', data.user);
                
              
                const card = document.getElementById('loginCard');
                if (card) {
                    card.style.transform = 'translateY(15px)';
                    card.style.opacity = '0';
                }
                
                console.log("StockVision AI: Redirecting to dashboard...");
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 300);
            } else {
                console.warn("StockVision AI: Login failed with message:", data.message);
         
                errorMessage.innerText = data.message || 'Verification failed. Please review credentials.';
                loginError.classList.remove('hidden');
                submitBtn.disabled = false;
                submitBtn.querySelector('span').innerText = 'Verify Credentials';
            }
        } catch (err) {
            console.error('StockVision AI: Auth request error:', err);
            errorMessage.innerText = 'Network error: Cannot reach authentication server.';
            loginError.classList.remove('hidden');
            submitBtn.disabled = false;
            submitBtn.querySelector('span').innerText = 'Verify Credentials';
        }
    });
}


if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLogin);
} else {
    initLogin();
}

