import { readFile } from 'fs/promises';
import { join } from 'path';
import net from 'net';

const COMMON_PORTS = [3000, 5173, 5174, 8000, 8080, 4321, 3001];

async function isPortOpen(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();

    socket.setTimeout(1000);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

async function parsePackageJsonPorts(projectRoot: string): Promise<number[]> {
  try {
    const pkgPath = join(projectRoot, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const ports: number[] = [];
    const scriptStr = JSON.stringify(pkg.scripts || {});

    const portMatch = scriptStr.match(/--port[=\s]+(\d+)/);
    if (portMatch) {
      ports.push(parseInt(portMatch[1], 10));
    }

    const portEnvMatch = scriptStr.match(/PORT[=\s]+(\d+)/);
    if (portEnvMatch) {
      ports.push(parseInt(portEnvMatch[1], 10));
    }

    return ports;
  } catch {
    return [];
  }
}

export async function detectPort(projectRoot: string): Promise<number | null> {
  const hintPorts = await parsePackageJsonPorts(projectRoot);
  const portsToCheck = [...new Set([...hintPorts, ...COMMON_PORTS])];

  for (const port of portsToCheck) {
    if (await isPortOpen(port)) {
      return port;
    }
  }

  return null;
}
