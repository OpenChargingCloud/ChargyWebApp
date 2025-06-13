# Chargy as a Serivce

This documentation shows you how to run ChargyWebApp as a service on systemd Linux distributions.
It will use the normal system logging and restart the service when it crashed.


## 1. Create a Service file

```
$ sudo nano /etc/systemd/system/chargyweb.service

[Unit]
Description=Chargy WebApp (npm start)
After=network.target

[Service]
Type=simple
User=chargeit
WorkingDirectory=/use/src/ChargyWebApp
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Note: Make sure, that the working directory and the executable `/usr/bin/npm` are correct.    
You can verify the location of `npm` via:
```
which npm
```


## 2. Activate the service

```
sudo systemctl daemon-reexec
sudo systemctl daemon-reload
sudo systemctl enable chargyweb
sudo systemctl start chargyweb
```


## 3. Check the status of the service

```
systemctl status chargyweb
```


## 4. Read the service logs

```
journalctl -u chargyweb -f
```


## 5. Update and Restart

```
git pull
npm install
sudo systemctl restart chargyweb
```
