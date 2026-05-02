async function runTests() {
  try {
    console.log('Registering user with recovery key...');
    const registerRes = await fetch('http://localhost:3000/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_recovery', password: 'old_password', recoveryKey: 'my_secret_recovery' })
    });
    console.log('Register status:', registerRes.status);
    
    console.log('Resetting password with recovery key...');
    const resetRes = await fetch('http://localhost:3000/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_recovery', recoveryKey: 'my_secret_recovery', newPassword: 'new_password' })
    });
    console.log('Reset status:', resetRes.status);
    
    console.log('Logging in with new password...');
    const loginRes = await fetch('http://localhost:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test_recovery', password: 'new_password' })
    });
    console.log('Login status:', loginRes.status);
    const text = await loginRes.text();
    console.log('Login response:', text);
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runTests();
