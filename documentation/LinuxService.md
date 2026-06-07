# Chargy WebApp on Linux

This document describes how to run Chargy WebApp on a Linux server. The application is a static browser application after the Webpack build. For production, do not run `npm start`: that command starts `webpack-dev-server`, which is intended for local development.

The recommended production setup is:

1. Build the static files into `build/`.
2. Serve `build/` with a normal web server such as nginx, Apache or Caddy.
3. Let systemd manage the web server, not the Webpack development server.


## Development

For local development:

```sh
npm install
npm run build
npm start
```

The development server listens on port `1608`.


## Production build

Install dependencies and create an optimized production build:

```sh
npm ci
npm run build:production
```

The generated files are written to:

```text
build/
```

You can deploy this directory as static web content.


## nginx example

Install nginx and copy or keep the repository on the server, for example under `/home/chargy/ChargyWebApp`.

Example virtual host:

```nginx
server {
    listen 80;
    server_name chargy.charging.cloud;

    root /home/chargy/ChargyWebApp/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf)$ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public";
    }
}
```

Enable the site and reload nginx. On Debian/Ubuntu-style systems this usually looks like:

```sh
sudo ln -s /etc/nginx/sites-available/chargyweb /etc/nginx/sites-enabled/chargyweb
sudo nginx -t
sudo systemctl reload nginx
```

For HTTPS, add a certificate with your normal ACME/Let's Encrypt tooling, for example certbot.


## Updating the deployment

From the application directory:

```sh
git pull
npm ci
npm run build:production
sudo systemctl reload nginx
```


## Optional: systemd service for the development server

Only use this variant for internal testing, because it runs `webpack-dev-server`.

```ini
[Unit]
Description=Chargy WebApp Development Server
After=network.target

[Service]
Type=simple
User=chargy
WorkingDirectory=/home/chargy/ChargyWebApp
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=development
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Activate it with:

```sh
sudo systemctl daemon-reload
sudo systemctl enable chargyweb
sudo systemctl start chargyweb
```

Check status and logs:

```sh
systemctl status chargyweb
journalctl -u chargyweb -f
```
