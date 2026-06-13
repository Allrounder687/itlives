async function test() {
  const characters = ['raiden', 'ganyu', 'makima', 'tifa', '2b', 'ahri', 'jinx', 'zero-two', 'yor'];
  for (const c of characters) {
    const url = `https://motionbgs.com/tag:${c}/`;
    try {
      const r = await fetch(url);
      console.log(`Character: ${c} | Status: ${r.status}`);
    } catch (e) {
      console.error(e);
    }
  }
}

test();
