java -version

front_dir=chat2db-server-start/src/main/resources/static/front
if [ ! -d "${front_dir}" ]; then
    echo "Please deploy front first!"
    exit 0
fi

mvn clean install
