module.exports = {
  apps: [
    {
      name: "photoportugal",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/photoportugal",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "500M",
      error_file: "/root/.pm2/logs/photoportugal-error.log",
      out_file: "/root/.pm2/logs/photoportugal-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
