echo "Build chat2db-server..."

java_version=`java -version`
if [ $? != 0 ]; then
    echo "Can NOT find java install."
    exit 0
fi
echo "$java_version"

front_dir=chat2db-server-start/src/main/resources/static/front
if [ ! -d "${front_dir}" ]; then
    echo "Please deploy front first!"
    exit 0
fi

mvn clean install

echo "Build jar into: chat2db-server/chat2db-server-start/target/chat2db-server-start.jar"
