npm install
npm run build:prod
tgt_dir=../chat2db-server/chat2db-server-start/src/main/resources/static/front
rm -rf ${tgt_dir} && cp -r dist ${tgt_dir}
echo "Deploy to ${tgt_dir}"
