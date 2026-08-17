const { spawnSync } = require('node:child_process');

const secretRules = [
  { name: 'clave privada', pattern: '-----BEGIN ([A-Z0-9 ]+ )?PRIVATE KEY-----' },
  { name: 'token de GitHub', pattern: 'gh[pousr]_[A-Za-z0-9]{20,}' },
  { name: 'clave de API de Google', pattern: 'AIza[0-9A-Za-z_-]{30,}' },
  { name: 'access key de AWS', pattern: 'AKIA[0-9A-Z]{16}' },
  { name: 'token de Slack', pattern: 'xox[baprs]-[A-Za-z0-9-]{10,}' },
  { name: 'cookie de sesión serializada', pattern: 's%3A[A-Za-z0-9_-]{20,}' },
];

const allowedEnvironmentExamples = new Set([
  '.env.example',
  'web/.env.example',
]);

const sensitiveFilePatterns = [
  { name: 'archivo de entorno', test: (path) => /(^|\/)\.env(?:\..+)?$/i.test(path) },
  { name: 'archivo de cookies', test: (path) => /(^|\/)cookies?\.txt$/i.test(path) },
  { name: 'clave o certificado privado', test: (path) => /\.(?:key|pem|p12|pfx)$/i.test(path) },
];

function runGit(args, acceptedStatuses = [0]) {
  const result = spawnSync('git', args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    windowsHide: true,
  });

  if (!acceptedStatuses.includes(result.status)) {
    const message = (result.stderr || '').trim() || `git terminó con código ${result.status}`;
    throw new Error(message);
  }

  return result.stdout || '';
}

function nonEmptyLines(value) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function auditContent(commits) {
  const findings = new Set();

  for (const rule of secretRules) {
    for (const commit of commits) {
      const matches = runGit(
        ['grep', '-I', '-l', '-E', '-e', rule.pattern, commit, '--'],
        [0, 1],
      );

      for (const match of nonEmptyLines(matches)) {
        findings.add(`${rule.name}\t${match}`);
      }
    }
  }

  return [...findings].sort();
}

function auditFileNames() {
  const lines = runGit(['log', '--all', '--name-only', '--format=commit:%H'])
    .split(/\r?\n/);
  const findings = new Set();
  let commit = 'desconocido';

  for (const line of lines) {
    if (line.startsWith('commit:')) {
      commit = line.slice('commit:'.length);
      continue;
    }

    const normalizedPath = line.trim().replace(/\\/g, '/');

    if (!normalizedPath || allowedEnvironmentExamples.has(normalizedPath)) {
      continue;
    }

    for (const rule of sensitiveFilePatterns) {
      if (rule.test(normalizedPath)) {
        findings.add(`${rule.name}\t${commit}:${normalizedPath}`);
      }
    }
  }

  return [...findings].sort();
}

function printFindings(title, findings) {
  if (findings.length === 0) {
    console.log(`OK: no se detectaron ${title}`);
    return;
  }

  console.error(`ALERTA: se detectaron ${title}`);
  for (const finding of findings) {
    const [rule, location] = finding.split('\t');
    console.error(`- ${rule}: ${location}`);
  }
}

try {
  runGit(['rev-parse', '--is-inside-work-tree']);
  const commits = nonEmptyLines(runGit(['rev-list', '--all']));
  const contentFindings = auditContent(commits);
  const fileNameFindings = auditFileNames();

  console.log(`Commits revisados: ${commits.length}`);
  printFindings('firmas conocidas de secretos', contentFindings);
  printFindings('nombres de archivos sensibles', fileNameFindings);

  if (contentFindings.length > 0 || fileNameFindings.length > 0) {
    console.error('La auditoría requiere revisión manual. No se muestran valores sensibles.');
    process.exitCode = 1;
  } else {
    console.log('Auditoría completada sin hallazgos.');
  }
} catch (error) {
  console.error(`No fue posible auditar el historial: ${error.message}`);
  process.exitCode = 2;
}
