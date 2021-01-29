#!/bin/bash
echo "Install kitten-mq"
echo "Get binary..."
# Get package version
PACKAGE_VERSION=$(
  curl  -s 'https://raw.githubusercontent.com/Ideolys/kitten-mq/master/package.json' \
  | grep version \
  | head -1 \
  | awk -F: '{ print $2 }' \
  | sed 's/[",]//g' \
  | tr -d '[[:space:]]')

echo "... found version ${PACKAGE_VERSION}"

if [ -f 'build.tar.gz' ]
then
  echo "Found old binary"
  sudo rm build.tar.gz
  echo "Old binary deleted"
fi

curl -LJOs https://github.com/Ideolys/kitten-mq/releases/download/v${PACKAGE_VERSION}/build.tar.gz
echo "Get binary...OK"

if [ ! -d '/var/www/kitten-mq' ]
then
  echo "Set kitten-mq directory..."
  mkdir /var/www/kitten-mq
  sudo adduser kitten-mq --no-create-home --disabled-password --system --group
  curl -s https://raw.githubusercontent.com/Ideolys/kitten-mq/v${PACKAGE_VERSION}/bin/config.json > /var/www/kitten-mq/kitten-mq.config.json
  sudo chown -R kitten-mq:kitten-mq /var/www/kitten-mq
  echo "Set kitten-mq directory...OK"
fi

sudo -u kitten-mq tar -xzf build.tar.gz -C /var/www/kitten-mq

echo "Register service..."
curl -s https://raw.githubusercontent.com/Ideolys/kitten-mq/v${PACKAGE_VERSION}/bin/systemd > /etc/systemd/system/kitten-mq.service
sudo systemctl daemon-reload > /dev/null 2>&1
sudo systemctl enable kitten-mq
echo "Register service...OK"

echo "Installation done ! Run 'sudo systemctl start kitten-mq' to launch kitten-mq"
