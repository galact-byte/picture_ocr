const LOCK_DATABASE = 'evidence-command-write-lock';
const LOCK_STORE = 'mutex';
const LOCK_TIMEOUT_MS = 10000;

/** 回调必须同步完成整个 localStorage 读改写，不得 await 或嵌套取得此锁。 */
export function withCommandWriteLock<T>(write: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    let db: IDBDatabase | undefined;
    let transaction: IDBTransaction | undefined;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      db?.close();
      reject(error);
    };
    const timer = setTimeout(() => {
      // 超时只发生在取得锁之前；abort 后迟到的请求不得执行写入。
      fail(new Error('等待命令存储锁超时，未写入，请稍后重试。'));
      transaction?.abort();
    }, LOCK_TIMEOUT_MS);
    try {
      if (!globalThis.indexedDB) throw new Error('命令存储锁不可用，未写入，已有内容已保留。');
      const open = indexedDB.open(LOCK_DATABASE, 1);
      open.onupgradeneeded = () => {
        if (!open.result.objectStoreNames.contains(LOCK_STORE)) open.result.createObjectStore(LOCK_STORE);
      };
      open.onerror = () => fail(new Error('无法打开命令存储锁，未写入，已有内容已保留。'));
      open.onblocked = () => fail(new Error('命令存储锁被占用，未写入，请关闭其他旧窗口后重试。'));
      open.onsuccess = () => {
        db = open.result;
        if (settled) { db.close(); return; }
        db.onversionchange = () => db?.close();
        try {
          const tx = transaction = db.transaction(LOCK_STORE, 'readwrite');
          tx.oncomplete = () => db?.close();
          tx.onabort = () => {
            db?.close();
            fail(new Error('命令存储锁已中止，未写入，已有内容已保留。'));
          };
          tx.onerror = () => fail(new Error('命令存储锁读取失败，未写入，已有内容已保留。'));
          // 请求成功才表示此 readwrite 事务已获得同源跨连接独占访问。
          const request = tx.objectStore(LOCK_STORE).get('write');
          request.onsuccess = () => {
            if (settled) return;
            clearTimeout(timer);
            try {
              const result = write();
              // 持久化点是同步 setItem，不是空 IDB 事务提交；两者不能原子回滚。
              settled = true;
              resolve(result);
            } catch (error) {
              fail(error);
              tx.abort();
            }
          };
        } catch (error) { fail(error); }
      };
    } catch (error) { fail(error); }
  });
}
