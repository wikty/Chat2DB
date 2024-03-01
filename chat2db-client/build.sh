echo "Build chat2db-client..."
mode=$1
if [ "$mode" == "install" ]; then
    npm install
fi

rm -rf dist && npm run build:prod
tgt_dir=../chat2db-server/chat2db-server-start/src/main/resources/static/front
rm -rf ${tgt_dir} && cp -r dist ${tgt_dir}
echo "Deploy chat2db-client to ${tgt_dir}"
