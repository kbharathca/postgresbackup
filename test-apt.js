const { execSync } = require('child_process');
try {
  execSync('export DEBIAN_FRONTEND=noninteractive && dpkg --configure -a --force-confdef --force-confold', { stdio: 'inherit' });
  execSync('export DEBIAN_FRONTEND=noninteractive && apt-get update && apt-get install -y curl lsb-release gnupg2 ca-certificates zip', { stdio: 'inherit' });
  execSync('curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --yes --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg', { stdio: 'inherit' });
  execSync('echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list', { stdio: 'inherit' });
  execSync('export DEBIAN_FRONTEND=noninteractive && apt-get update', { stdio: 'inherit' });
  execSync('export DEBIAN_FRONTEND=noninteractive && apt-get install -y postgresql-client-18', { stdio: 'inherit' });
  execSync('pg_dump --version', { stdio: 'inherit' });
} catch (e) {
  console.error(e.message);
}
