// 清除 localStorage 中的所有数据
if (typeof window !== 'undefined' && window.localStorage) {
  const keys = Object.keys(localStorage);
  console.log('LocalStorage keys to clear:', keys);

  keys.forEach(key => {
    if (key.includes('agent') || key.includes('config') || key.includes('Agent')) {
      console.log(`Clearing: ${key}`);
      localStorage.removeItem(key);
    }
  });

  console.log('Cleared agent-related localStorage items');
  console.log('Remaining keys:', Object.keys(localStorage));
}
