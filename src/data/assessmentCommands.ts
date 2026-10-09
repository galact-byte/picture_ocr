export type CommandFamily = 'network' | 'security' | 'server' | 'database';

export interface CommandSnippet {
  id: string;
  title: string;
  command: string;
  note?: string;
}
export interface CommandGroup {
  id: string;
  title: string;
  environment: string;
  note?: string;
  snippets: CommandSnippet[];
  viewingSteps?: string[];
}
export interface CommandProfile {
  id: string;
  family: CommandFamily;
  label: string;
  source: string;
  groups: CommandGroup[];
}
export const commandFamilies: { id: CommandFamily; label: string }[] = [
  { id: 'network', label: '网络设备' }, { id: 'security', label: '安全设备' },
  { id: 'server', label: '服务器' }, { id: 'database', label: '数据库' },
];

type SnippetInput = [title: string, command: string, note?: string];
function group(id: string, title: string, environment: string, entries: SnippetInput[], note?: string, viewingSteps?: string[]): CommandGroup {
  return { id, title, environment, note, viewingSteps, snippets: entries.map(([title, command, note], i) => ({ id: `${id}-${i + 1}`, title, command, ...(note ? { note } : {}) })) };
}
function profile(id: string, family: CommandFamily, label: string, source: string, groups: CommandGroup[]): CommandProfile {
  return { id, family, label, source, groups: groups.map(g => ({ ...g, id: `${id}-${g.id}`, snippets: g.snippets.map(s => ({ ...s, id: `${id}-${s.id}` })) })) };
}
const cli = '设备 CLI';
const shell = 'Linux Shell';
const sql = '数据库 SQL';
const admin = '部分查询需要管理员权限；以实际产品版本支持的命令为准。';
const templateSource = '服务器和数据库测评命令（S3A3G3结果记录模板V5.0）.md';

function networkGroups(h3c: boolean): CommandGroup[] {
  return [
    group('identity', '身份鉴别', cli, [
      ['本地用户', 'display local-user'], ['认证配置', 'display current-configuration'],
      ...(h3c ? [['密码控制策略', 'display password-control', '需产品启用并支持 password-control；华为平台不使用此条。'] as SnippetInput] : []),
    ], admin),
    group('remote', '远程管理与登录', cli, [
      ['终端登录配置', 'display user-interface'],
      ['SSH 服务与用户', 'display ssh server status\ndisplay ssh user-information\ndisplay ssh server session'],
      ['在线用户', 'display users'],
    ], admin),
    group('access', '访问控制', cli, [['访问控制列表', 'display acl all'], ['接口地址', 'display ip interface brief']], admin),
    group('audit', '日志审计', cli, [['日志配置', 'display info-center'], ['日志缓冲区', 'display logbuffer'], ['设备时间', 'display clock']], '日志缓冲区仅包含当前留存的日志，还需核对外部日志服务器与留存策略。'),
    group('version', '版本与运行状态', cli, [
      ['关闭本次终端分页', h3c ? 'screen-length disable' : 'screen-length 0 temporary', '仅调整当前终端会话的分页显示，不是安全配置核查。'],
      ['设备版本', 'display version'], ['CPU 与内存', 'display cpu-usage\ndisplay memory-usage'],
    ], admin),
  ];
}
function linuxGroups(debian: boolean): CommandGroup[] {
  const pam = debian ? '/etc/pam.d/common-password' : '/etc/pam.d/system-auth\ncat /etc/pam.d/password-auth';
  const auth = debian ? '/etc/pam.d/common-auth' : '/etc/pam.d/system-auth';
  return [
    group('identity', '身份鉴别', shell, [
      ['用户列表', 'getent passwd'], ['密码复杂度策略', `cat ${pam}`],
      ['密码有效期与默认策略', 'cat /etc/login.defs', '这是新建账号的默认策略；既有账号的实际有效期需单独核对。'],
      ['指定账号的密码有效期', 'chage -l <username>', '将 <username> 替换为现场账号名后执行。'],
    ], '部分文件需要管理员权限；PAM 模块及路径依发行版和版本不同。'),
    group('failures', '登录失败与超时', shell, [
      ['PAM 登录失败策略', `cat ${auth}`], ['会话超时配置', 'cat /etc/profile', '同时检查用户环境及 profile.d 中的覆盖项。'],
    ], '查看 PAM 的 faillock / tally 配置；模块名称随版本变化，不能只据文件存在作结论。'),
    group('access', '访问控制', shell, [
      ['账号权限与特权配置', 'cat /etc/passwd\ncat /etc/sudoers'],
      ['重要账号文件权限', 'ls -l /etc/passwd /etc/shadow /etc/group /etc/gshadow'],
    ], 'sudoers 查询需要管理员权限；不要仅按账号名称推断实际权限。'),
    group('remote', '远程管理', shell, [['SSH 配置', 'cat /etc/ssh/sshd_config', '还需核对 Include 文件、Match 块及实际生效配置。']], admin),
    group('audit', '日志审计', shell, [
      ['日志服务配置', 'cat /etc/rsyslog.conf'], ['审计规则', 'auditctl -l', '需要管理员权限和 audit 服务。'],
      ['近期登录', 'last'], ['审计服务状态', 'systemctl status auditd', '适用于使用 systemd 且已安装 auditd 的系统。'],
    ], '审计服务状态与规则分别核对；还需查看实际日志和留存策略。'),
    group('version', '版本与网络', shell, [['系统版本', 'cat /etc/os-release\nuname -a'], ['监听端口', 'ss -tulnp', '进程信息可能需要管理员权限。']], 'ss 与 systemctl 依赖目标系统安装相应工具。'),
  ];
}

export const assessmentCommandProfiles: CommandProfile[] = [
  profile('huawei', 'network', '华为交换机 / 路由器', '交换机测评内容.md；现场粘贴清单/华为H3C-交换机路由器-宏.txt', networkGroups(false)),
  profile('h3c', 'network', 'H3C 交换机 / 路由器', '交换机测评内容.md；现场粘贴清单/华为H3C-交换机路由器-宏.txt', networkGroups(true)),
  profile('huawei-usg', 'security', '华为 USG 防火墙', '防火墙测评内容.md；现场粘贴清单/华为USG防火墙-宏.txt', [
    group('identity', '身份鉴别', cli, [['本地用户', 'display local-user'], ['AAA 与认证配置', 'display aaa\ndisplay current-configuration']], admin),
    group('failures', '密码与登录策略', cli, [['密码策略', 'display password-policy', '仅在该 USG 版本支持时使用；不支持时查看当前配置中的 AAA 与本地用户策略。'], ['终端登录配置', 'display user-interface']], admin),
    group('remote', '远程管理', cli, [['SSH 服务与用户', 'display ssh server status\ndisplay ssh user-information\ndisplay ssh server session'], ['VTY 配置', 'display current-configuration | include vty']], admin),
    group('access', '访问控制', cli, [['安全策略', 'display security-policy'], ['访问控制列表', 'display acl all'], ['会话统计', 'display firewall session statistics']], admin),
    group('audit', '日志审计', cli, [['日志配置', 'display info-center'], ['日志缓冲区', 'display logbuffer'], ['设备时间', 'display clock']], '还需核对日志发送、覆盖范围及留存策略。'),
    group('version', '版本与网络', cli, [['设备版本', 'display version'], ['接口地址', 'display ip interface brief']], admin),
  ]),
  profile('linux-rhel', 'server', 'Linux · RHEL / CentOS', `Linux测评内容.md；${templateSource}`, linuxGroups(false)),
  profile('linux-debian', 'server', 'Linux · Debian / Ubuntu', `Linux测评内容.md；现场粘贴清单/Linux-Ubuntu-整段粘贴.txt；${templateSource}`, linuxGroups(true)),
  profile('windows', 'server', 'Windows', `Windows测评内容.md；${templateSource}`, [
    group('identity', '身份鉴别', 'Windows CMD', [
      ['本地用户与账号策略', 'net user\nnet accounts'],
      ['导出并查看密码策略', 'secedit /export /cfg %TEMP%\\secpol.cfg\nfindstr /i "PasswordComplexity MinimumPasswordLength MinimumPasswordAge MaximumPasswordAge PasswordHistorySize ClearTextPassword" %TEMP%\\secpol.cfg', '以管理员身份打开 CMD；会写入并覆盖临时目录下的 secpol.cfg。'],
    ], 'CMD 命令；域账号策略需在相应域环境另外核对。', ['secpol.msc → 安全设置 → 账户策略 → 密码策略', 'lusrmgr.msc → 用户（部分 Windows 版本不提供此管理器）']),
    group('failures', '登录失败与超时', 'Windows CMD', [['账号锁定策略', 'net accounts']], '组策略可能覆盖本地策略，应核对实际生效策略。', ['secpol.msc → 安全设置 → 账户策略 → 账户锁定策略', 'gpedit.msc → 计算机配置 → 管理模板 → Windows 组件 → 远程桌面服务 → 远程桌面会话主机 → 会话时间限制']),
    group('audit', '日志审计', 'Windows CMD', [['审核策略', 'auditpol /get /category:*'], ['事件日志列表', 'wevtutil el']], '审核策略查询可能需要管理员权限。', ['secpol.msc → 安全设置 → 本地策略 → 审核策略', 'eventvwr.msc → Windows 日志 → 安全 / 系统 / 应用程序']),
    group('version', '版本与网络', 'Windows CMD', [['系统信息', 'systeminfo'], ['网络配置', 'ipconfig /all'], ['监听与连接', 'netstat -ano']], '命令在 CMD 中执行，结果需结合实际资产和进程信息核查。'),
  ]),
  profile('mysql', 'database', 'MySQL / MariaDB', `Mysql测评内容.md；${templateSource}`, [
    group('identity', '身份鉴别', sql, [['用户与来源主机', 'SELECT user, host FROM mysql.user;'], ['密码校验策略', "SHOW VARIABLES LIKE '%validate%';"]], '需要读取 mysql 系统库权限；密码插件/组件因版本不同，空结果不能直接推断已启用校验。'),
    group('failures', '登录失败与超时', sql, [['连接控制插件参数', "SHOW VARIABLES LIKE '%connection_control%';"], ['连接超时参数', "SHOW VARIABLES LIKE '%timeout%';"]], 'connection_control 依赖插件；wait_timeout 不代表所有客户端或所有连接的完整超时策略。'),
    group('remote', '远程管理与加密', sql, [['全局 SSL 支持', "SHOW VARIABLES LIKE '%have_ssl%';\nSHOW VARIABLES LIKE '%have_openssl%';", '部分新版移除这些变量；核对当前连接加密状态。'], ['当前连接的加密套件', "SHOW SESSION STATUS LIKE 'Ssl_cipher';", '非空仅表示当前会话使用 SSL，不表示全部连接强制加密。']]),
    group('audit', '日志审计', sql, [['日志与通用查询日志参数', "SHOW VARIABLES LIKE 'log_%';\nSHOW GLOBAL VARIABLES LIKE '%general%';"], ['通用查询日志', 'SELECT * FROM mysql.general_log LIMIT 100;', '仅在 general_log 启用且输出到 TABLE 时可查看；最多返回 100 条。']], '通用查询日志与二进制日志不等同于完整安全审计。'),
    group('version', '数据库版本', sql, [['版本参数', "SHOW VARIABLES LIKE '%version%';"]]),
  ]),
  profile('oracle', 'database', 'Oracle', 'Oracle测评内容.md', [
    group('identity', '身份鉴别', sql, [['账号与实际 Profile', 'SELECT username, account_status, profile FROM dba_users;'], ['密码策略', "SELECT profile, resource_name, limit FROM dba_profiles WHERE resource_type = 'PASSWORD';"]], '需要字典查询权限；结合每个账号的实际 Profile 核对，不只看 DEFAULT。'),
    group('failures', '登录失败与超时', sql, [['失败锁定与密码锁定时间', "SELECT profile, resource_name, limit FROM dba_profiles WHERE resource_name IN ('FAILED_LOGIN_ATTEMPTS', 'PASSWORD_LOCK_TIME');"], ['空闲超时', "SELECT profile, resource_name, limit FROM dba_profiles WHERE resource_name = 'IDLE_TIME';"]], '还需核对资源限制实际启用情况与账号的 Profile。'),
    group('access', '访问控制', sql, [['系统权限', 'SELECT * FROM dba_sys_privs;'], ['对象权限', 'SELECT * FROM dba_tab_privs;'], ['角色权限', 'SELECT * FROM dba_role_privs;']], '需要相应字典权限，结果可能较多。'),
    group('audit', '日志审计', sql, [['传统审计参数', "SELECT name, value FROM v$parameter WHERE name LIKE 'audit%';"], ['传统审计日志样例', 'SELECT * FROM dba_audit_trail WHERE ROWNUM <= 100;']], '传统审计视图不覆盖所有统一审计场景；需按 Oracle 版本核对。'),
    group('listener', '监听器状态', shell, [['监听器状态', 'lsnrctl status']], '在数据库宿主机、正确 Oracle 软件环境中执行，不能粘贴到 SQL 客户端。'),
    group('version', '数据库版本', sql, [['数据库版本', 'SELECT * FROM v$version;']]),
  ]),
  profile('dameng', 'database', '达梦 DM', '达梦测评内容.md', [
    group('identity', '身份鉴别', sql, [['密码策略', "SELECT * FROM v$parameter WHERE name = 'PWD_POLICY';\nSELECT * FROM v$parameter WHERE name LIKE '%PWD%';"], ['用户与账号状态', 'SELECT username, account_status FROM sys.dba_users;']], '使用具有相应系统视图查询权限的账号；不依赖部分 DM8 版本缺失的 PTIME 字段。'),
    group('failures', '登录失败与超时', sql, [['失败锁定参数', "SELECT * FROM v$parameter WHERE name LIKE 'FAILED_%' OR name LIKE 'LOCK_%';"], ['空闲超时参数', "SELECT * FROM v$parameter WHERE name LIKE '%IDLE%';"]], '还需核对实际账号是否受相应策略约束。'),
    group('access', '访问控制', sql, [['系统权限', 'SELECT * FROM dba_sys_privs;'], ['对象权限', 'SELECT * FROM dba_tab_privs;'], ['角色权限', 'SELECT * FROM dba_role_privs;']], admin),
    group('remote', '远程加密参数', sql, [['网络加密配置', "SELECT * FROM v$parameter WHERE name IN ('ENABLE_ENCRYPT', 'COMM_ENCRYPT_NAME');"]], '参数值只能反映配置；需结合实际连接与相应版本参数文档核对加密状态。'),
    group('audit', '日志审计', sql, [['日志参数', "SELECT * FROM v$dm_ini WHERE para_name IN ('SVR_LOG', 'SVR_LOG_NAME');"]], '服务日志不等同于安全审计；还需按目标版本查看安全审计配置与实际日志。'),
    group('version', '数据库版本', sql, [['数据库版本', 'SELECT * FROM v$version;']]),
  ]),
  profile('kingbase', 'database', '人大金仓 KingbaseES', `人大金仓测评内容.md；${templateSource}`, [
    group('identity', '身份鉴别', sql, [['用户与登录状态', 'SELECT rolname, rolcanlogin, rolvaliduntil FROM pg_roles;'], ['密码参数', "SHOW password_encryption;\nSELECT name, setting, description FROM sys_settings WHERE name LIKE '%password%';"], ['密码扩展', "SELECT * FROM pg_extension WHERE extname LIKE '%password%';"]], '笔记使用 sys_settings 与 pg_ 视图；视图别名及扩展依具体 KingbaseES 版本而异，不支持时核对该版本字典。'),
    group('failures', '登录失败与超时', sql, [['失败锁定参数', "SELECT name, setting, description FROM sys_settings WHERE name IN ('failed_login_attempts', 'password_lock_time', 'authentication_timeout');"], ['空闲事务超时', 'SHOW idle_in_transaction_session_timeout;']], '空闲事务超时不等于普通空闲会话超时。'),
    group('remote', '远程管理', sql, [['SSL 配置', 'SHOW ssl;', '这是服务端 SSL 开关，不证明所有会话强制使用 SSL。'], ['当前连接的 SSL 状态', 'SELECT ssl, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid();']], 'pg_stat_ssl 视图及字段依版本支持情况核对。'),
    group('audit', '日志审计', sql, [['日志配置', 'SHOW log_destination;\nSHOW logging_collector;\nSHOW log_directory;'], ['审计参数', "SELECT name, setting FROM sys_settings WHERE name LIKE '%audit%';"]], '审计扩展与普通服务日志需分别核对。'),
    group('access', '访问控制', sql, [['角色权限', 'SELECT rolname, rolsuper, rolcreaterole, rolcreatedb FROM pg_roles;'], ['对象权限', 'SELECT * FROM information_schema.role_table_grants;']], admin),
    group('config', '宿主机访问控制与配置', shell, [['认证与配置文件', 'cat <data_directory>/sys_hba.conf\ncat <data_directory>/kingbase.conf']], '在数据库宿主机执行；将 <data_directory> 替换为实际数据目录，认证文件名需按版本确认。'),
    group('version', '数据库版本', sql, [['数据库版本', 'SELECT version();']]),
  ]),
  profile('highgo-46', 'database', 'HighGo · V4 / V6', 'HighGo测评内容.md', [
    group('identity', '身份鉴别', sql, [['用户列表', 'SELECT rolname FROM pg_roles;'], ['密码复杂度参数', 'SHOW password_encryption;\nSHOW passwordcheck.min_length;\nSHOW passwordcheck.min_uppercase;\nSHOW passwordcheck.min_lowercase;\nSHOW passwordcheck.min_digits;']], 'passwordcheck 参数需要相应扩展。'),
    group('failures', '登录失败与超时', sql, [['失败锁定安全参数', 'SELECT show_secure_param();'], ['空闲事务超时', 'SHOW idle_in_transaction_session_timeout;']], 'show_secure_param 用于 V4/V6；空闲事务超时不等于一般会话超时。'),
    group('remote', '远程管理', sql, [['SSL 配置', 'SHOW ssl;']], '全局 SSL 开关不等于当前或全部连接加密。'),
    group('audit', '日志审计', sql, [['审计开关与留存配置', 'SHOW hg_audit;\nSHOW hg_audit_logsize;\nSHOW hg_audit_keep_days;'], ['日志目录', 'SHOW log_directory;\nSHOW log_filename;']], 'hg_audit 参数依产品版本支持情况；还需查看实际审计日志。'),
    group('version', '数据库版本', sql, [['数据库版本', 'SELECT version();']]),
  ]),
  profile('highgo-9', 'database', 'HighGo · V9', 'HighGo测评内容.md', [
    group('identity', '身份鉴别', sql, [['用户列表', 'SELECT rolname FROM pg_roles;'], ['密码复杂度参数', 'SHOW password_encryption;\nSHOW passwordcheck.min_length;\nSHOW passwordcheck.min_uppercase;\nSHOW passwordcheck.min_lowercase;\nSHOW passwordcheck.min_digits;']], 'passwordcheck 参数依扩展与具体版本支持情况。'),
    group('failures', '登录失败与超时', sql, [['失败锁定', 'SHOW credcheck.max_auth_failure;\nSHOW credcheck.reset_time_min;'], ['空闲事务超时', 'SHOW idle_in_transaction_session_timeout;']], 'credcheck 参数用于 V9 并依赖扩展；空闲事务超时需结合会话策略核对。'),
    group('remote', '远程管理', sql, [['SSL 配置', 'SHOW ssl;']], '全局 SSL 开关不等于当前或全部连接加密。'),
    group('audit', '日志审计', sql, [['日志配置', 'SHOW logging_collector;\nSHOW log_connections;\nSHOW log_disconnections;\nSHOW log_statement;\nSHOW log_duration;'], ['审计开关与留存配置', 'SHOW hg_audit;\nSHOW hg_audit_logsize;\nSHOW hg_audit_keep_days;']], 'hg_audit 参数依具体版本支持情况；还需核对实际日志与审计覆盖范围。'),
    group('version', '数据库版本', sql, [['数据库版本', 'SELECT version();']]),
  ]),
];
