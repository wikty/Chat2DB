port=$1
version=$2
renew_db=$3
db_dir=~/.chat2db/db

if [ -z "${port}" ]; then
    port=18020
fi
if [ -z "${version}" ]; then
    version=v1.0.2
fi
if [ -z "${renew_db}" ]; then
    renew_db=no
fi

####
# Check java version >= 18
####
java_min_version=18
echo "Check java version..."
if type -p java > /dev/null 2>&1; then
    echo "Found java executable in PATH"
    _java=java
elif [[ -n "$JAVA_HOME" ]] && [[ -x "$JAVA_HOME/bin/java" ]];  then
    echo "Found java executable in JAVA_HOME"
    _java="$JAVA_HOME/bin/java"
else
    echo "NOT Found java, please install java first!"
    exit 0
fi
if [[ "$_java" ]]; then
    java_version=$("$_java" -version 2>&1 | awk -F '"' '/version/ {print $2}')
    if [ "$java_version" -ge "${java_min_version}" ]; then
        echo "Java version ${java_version} is more than ${java_min_version}"
    else
        echo "Java version ${java_version} is less than ${java_min_version}, please upgrade java first!"
        exit 0
    fi
fi

echo "Check the chat2db jar..."
jar_path=chat2db-server-start.${version}.jar
if [ ! -s "${jar_path}" ]; then
    echo "NOT found the release jar file: ${jar_path}"
else
    echo "The path of chat2db is: ${jar_path}"
fi
if [ "$renew_db" == "yes" ]; then
    rm -rf $db_dir
    echo "The db of chat2db is renewed."
fi

java -jar -Dserver.port=${port} ${jar_path}
