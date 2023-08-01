package ai.chat2db.plugin.postgresql;

import ai.chat2db.spi.MetaData;
import ai.chat2db.spi.jdbc.DefaultMetaService;
import ai.chat2db.spi.sql.SQLExecutor;

import java.sql.SQLException;

public class PostgreSQLMetaData extends DefaultMetaService implements MetaData {
    private String functionSQL =
            "CREATE OR REPLACE FUNCTION showcreatetable(namespace character varying, tablename character "
                    + "varying)\n"
                    + "        RETURNS character varying AS\n"
                    + "\n"
                    + "        $BODY$\n"
                    + "        declare\n"
                    + "        tableScript character varying default '';\n"
                    + "\n"
                    + "        begin\n"
                    + "        -- columns\n"
                    + "        tableScript:=tableScript || ' CREATE TABLE '|| tablename|| ' ( '|| chr(13)||chr(10) || "
                    + "array_to_string"
                    + "(\n"
                    + "        array(\n"
                    + "        select ' ' || concat_ws(' ',fieldName, fieldType, fieldLen, indexType, isNullStr, fieldComment"
                    + " ) as "
                    + "column_line\n"
                    + "        from (\n"
                    + "        select a.attname as fieldName,format_type(a.atttypid,a.atttypmod) as fieldType,(case when "
                    + "atttypmod-4>0 then\n"
                    + "        atttypmod-4 else 0 end) as fieldLen,\n"
                    + "        (case when (select count(*) from pg_constraint where conrelid = a.attrelid and conkey[1]=attnum "
                    + "and\n"
                    + "        contype='p')>0 then 'PRI'\n"
                    + "        when (select count(*) from pg_constraint where conrelid = a.attrelid and conkey[1]=attnum and "
                    + "contype='u')>0\n"
                    + "        then 'UNI'\n"
                    + "        when (select count(*) from pg_constraint where conrelid = a.attrelid and conkey[1]=attnum and "
                    + "contype='f')>0\n"
                    + "        then 'FRI'\n"
                    + "        else '' end) as indexType,\n"
                    + "        (case when a.attnotnull=true then 'not null' else 'null' end) as isNullStr,\n"
                    + "        ' COMMENT ' || col_description(a.attrelid,a.attnum) as fieldComment\n"
                    + "        from pg_attribute a where attstattarget=-1 and attrelid = (select c.oid from pg_class c,"
                    + "pg_namespace n"
                    + " where\n"
                    + "        c.relnamespace=n.oid and n.nspname =namespace and relname =tablename)\n"
                    + "\n"
                    + "        ) as string_columns\n"
                    + "        ),','||chr(13)||chr(10)) || ',';\n"
                    + "\n"
                    + "\n"
                    + "        -- 约束\n"
                    + "        tableScript:= tableScript || chr(13)||chr(10) || array_to_string(\n"
                    + "        array(\n"
                    + "        select concat(' CONSTRAINT ',conname ,c ,u,p,f) from (\n"
                    + "        select conname,\n"
                    + "        case when contype='c' then ' CHECK('|| ( select findattname(namespace,tablename,'c', conname) ) ||')' "
                    + "end "
                    + "as c "
                    + ",\n"
                    + "        case when contype='u' then ' UNIQUE('|| ( select findattname(namespace,tablename,'u', conname) ) ||')' "
                    + "end "
                    + "as u"
                    + " ,\n"
                    + "        case when contype='p' then ' PRIMARY KEY ('|| ( select findattname(namespace,tablename,'p', conname) ) "
                    + "||')' "
                    + "end as p ,\n"
                    + "        case when contype='f' then ' FOREIGN KEY('|| ( select findattname(namespace,tablename,'f', conname) ) "
                    + "||') REFERENCES '|| (select p.relname from pg_class p where p.oid=c.confrelid ) || "
                    + "        '(' || ( select findfkeyname(namespace,tablename,conname) ) ||')' "
                    + "end as f\n"
                    + "        from pg_constraint c\n"
                    + "        where contype in('u','c','f','p') and conrelid=(\n"
                    + "        select oid from pg_class where relname=tablename and relnamespace =(\n"
                    + "        select oid from pg_namespace where nspname = namespace\n"
                    + "        )\n"
                    + "        )\n"
                    + "        ) as t\n"
                    + "        ) ,',' || chr(13)||chr(10) ) || chr(13)||chr(10) ||' ); ';\n"
                    + "\n"
                    + "        -- indexs\n"
                    + "        -- CREATE UNIQUE INDEX pg_language_oid_index ON pg_language USING btree (oid); -- table "
                    + "pg_language\n"
                    + "\n"
                    + "\n"
                    + "        --\n"
                    + "        /** **/\n"
                    + "        --- 获取非约束索引 column\n"
                    + "        -- CREATE UNIQUE INDEX pg_language_oid_index ON pg_language USING btree (oid); -- table "
                    + "pg_language\n"
                    + "        tableScript:= tableScript || chr(13)||chr(10) || chr(13)||chr(10) || array_to_string(\n"
                    + "        array(\n"
                    + "        select 'CREATE INDEX ' || indexrelname || ' ON ' || tablename || ' USING btree '|| '(' || "
                    + "attname "
                    + "|| "
                    + "');' from (\n"
                    + "        SELECT\n"
                    + "        i.relname AS indexrelname , x.indkey,\n"
                    + "\n"
                    + "        ( select array_to_string (\n"
                    + "        array(\n"
                    + "        select a.attname from pg_attribute a where attrelid=c.oid and a.attnum in ( select unnest(x"
                    + ".indkey) )\n"
                    + "\n"
                    + "        )\n"
                    + "        ,',' ) )as attname\n"
                    + "\n"
                    + "        FROM pg_class c\n"
                    + "        JOIN pg_index x ON c.oid = x.indrelid\n"
                    + "        JOIN pg_class i ON i.oid = x.indexrelid\n"
                    + "        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace\n"
                    + "        WHERE c.relname=tablename and i.relname not in\n"
                    + "        ( select constraint_name from information_schema.key_column_usage where table_name=tablename )\n"
                    + "        )as t\n"
                    + "        ) ,','|| chr(13)||chr(10));\n"
                    + "\n"
                    + "\n"
                    + "        -- COMMENT ON TABLE users IS 'This is the table users';\n"
                    + "        tableScript:= tableScript || chr(13)||chr(10) || chr(13)||chr(10) || array_to_string(\n"
                    + "        array(\n"
                    + "        SELECT 'COMMENT ON TABLE ' || tablename || ' IS '|| ''''|| obj_description(c.oid) "
                    + "||''''\n"
                    + "        FROM pg_class c\n"
                    + "        WHERE c.relname=tablename\n"
                    + "        AND c.relkind='r'),','|| chr(13)||chr(10)) ;\n"
                    + "\n"
                    + "\n"
                    + "        -- COMMENT COMMENT ON COLUMN sys_activity.id IS '主键';\n"
                    + "        tableScript:= tableScript || chr(13)||chr(10) || chr(13)||chr(10) || array_to_string(\n"
                    + "        array(\n"
                    + "        SELECT 'COMMENT ON COLUMN ' || tablename || '.' || a.attname ||' IS '|| ''''|| d.description "
                    + "||''''\n"
                    + "        FROM pg_class c\n"
                    + "        JOIN pg_description d ON c.oid=d.objoid\n"
                    + "        JOIN pg_attribute a ON c.oid = a.attrelid\n"
                    + "        WHERE c.relname=tablename\n"
                    + "        AND a.attnum = d.objsubid),','|| chr(13)||chr(10)) ;\n"
                    + "\n"
                    + "        return tableScript;\n"
                    + "\n"
                    + "        end\n"
                    + "        $BODY$ LANGUAGE plpgsql;\n"
                    + "\n"
                    + "\n"
                    + "\n"
                    + "CREATE OR REPLACE FUNCTION findattname(namespace character varying, "
                    + "tablename character varying, "
                    + "ctype character varying, cname name)\n"
                    + "        RETURNS character varying as $BODY$\n"
                    + "        declare tt oid;\n"
                    + "        aname character varying default '';\n\n"
                    + "        begin\n"
                    + "        tt := oid from pg_class where relname= tablename and relnamespace = ("
                    + "            select oid from pg_namespace where nspname=namespace ) ;\n"
                    + "        aname:= array_to_string(\n"
                    + "            array(\n"
                    + "            select a.attname from pg_attribute a\n"
                    + "            where a.attrelid=tt and a.attnum in (\n"
                    + "            select unnest(conkey) from pg_constraint c where contype=ctype and conname=cname \n"
                    + "            and conrelid=tt and array_to_string(conkey,',') is not null )\n"
                    + "        ),',');\n"
                    + "\n"
                    + "        return aname;\n"
                    + "        end\n"
                    + "        $BODY$ LANGUAGE plpgsql;"
                    + "\n"
                    + "\n"
                    + "\n"
                    + "CREATE OR REPLACE FUNCTION findfkeyname(namespace character varying, "
                    + "tablename character varying, cname name)\n"
                    + "        RETURNS character varying as $BODY$\n"
                    + "        declare tt oid;\n"
                    + "        declare ft oid;\n"
                    + "        aname character varying default '';\n\n"
                    + "        begin\n"
                    + "        tt := oid from pg_class where relname= tablename and relnamespace = ("
                    + "            select oid from pg_namespace where nspname=namespace ) ;\n"
                    + "        ft := confrelid from pg_constraint where contype='f' and conname=cname and conrelid=tt;\n"
                    + "        aname := array_to_string(\n"
                    + "            array(\n"
                    + "              select a.attname from pg_attribute a \n"
                    + "              where attrelid = ft and \n"
                    + "                attnum = ANY((select unnest(confkey) from pg_constraint where conname=cname))\n"
                    + "              order by attnum\n"
                    + "        ),',');"
                    + "\n"
                    + "        return aname;\n"
                    + "        end\n"
                    + "        $BODY$ LANGUAGE plpgsql;";

    @Override
    public String tableDDL(String databaseName, String schemaName, String tableName) {
        SQLExecutor.getInstance().executeSql(functionSQL.replaceFirst("tableSchema", schemaName), resultSet -> null);
        String ddlSql = "select showcreatetable('" + schemaName + "','" + tableName + "') as sql";
        return SQLExecutor.getInstance().executeSql(ddlSql, resultSet -> {
            try {
                if (resultSet.next()) {
                    return resultSet.getString("sql");
                }
            } catch (SQLException e) {
                throw new RuntimeException(e);
            }
            return null;
        });
    }

}
