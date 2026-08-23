"""run-tests.py —— 單一執行入口

    python run-tests.py

會依序跑：
  1. node place-value-core.test.js   核心教學邏輯（讀法、分組算理、範圍契約）
  2. python e2e.spec.py              五頁端到端（自動起 http server 再關掉）

任一失敗即以非 0 結束。
"""
import subprocess, sys, socket, time, os
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
HERE = Path(__file__).resolve().parent


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    port = s.getsockname()[1]
    s.close()
    return port


def wait_port(port, timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            with socket.create_connection(('127.0.0.1', port), 0.4):
                return True
        except OSError:
            time.sleep(0.15)
    return False


def main():
    print('=' * 60)
    print('  1/2  核心教學邏輯  node place-value-core.test.js')
    print('=' * 60)
    r1 = subprocess.run(['node', 'place-value-core.test.js'], cwd=HERE)

    print()
    print('=' * 60)
    print('  2/2  五頁端到端  python e2e.spec.py')
    print('=' * 60)
    port = free_port()
    srv = subprocess.Popen(
        [sys.executable, '-m', 'http.server', str(port), '--bind', '127.0.0.1'],
        cwd=HERE, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        if not wait_port(port):
            print('  伺服器起不來')
            return 1
        r2 = subprocess.run([sys.executable, 'e2e.spec.py', str(port)], cwd=HERE)
    finally:
        srv.terminate()
        try:
            srv.wait(timeout=5)
        except subprocess.TimeoutExpired:
            srv.kill()

    print()
    print('=' * 60)
    ok = (r1.returncode == 0 and r2.returncode == 0)
    print('  結果：核心邏輯 %s ｜ 端到端 %s'
          % ('通過' if r1.returncode == 0 else '失敗',
             '通過' if r2.returncode == 0 else '失敗'))
    print('=' * 60)
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
