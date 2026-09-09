require('./patch-backup-server.cjs');
require('./patch-backup-frontend.cjs');
require('./patch-admin-password-ui.cjs');
require('./write-loadtest-recovery.cjs');
console.log('All targeted backup/restore and account recovery patches applied.');
