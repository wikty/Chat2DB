package ai.chat2db.server.web.api.controller.rdb.request;

import java.io.Serial;

import jakarta.validation.constraints.NotNull;

import ai.chat2db.server.tools.base.wrapper.request.PageQueryRequest;
import ai.chat2db.server.web.api.controller.data.source.request.DataSourceBaseRequestInfo;

import lombok.Data;

/**
 * @author moji
 * @version ConnectionQueryRequest.java, v 0.1 2022年09月16日 14:23 moji Exp $
 * @date 2022/09/16
 */
@Data
public class TableBriefQueryRequest extends PageQueryRequest implements DataSourceBaseRequestInfo {

    @Serial
    private static final long serialVersionUID = -364547173428396332L;
    /**
     * 数据源id
     */
    @NotNull
    private Long dataSourceId;
    /**
     * DB名称
     */
    private String databaseName;

    /**
     * 表所在空间，pg,oracle需要，mysql不需要
     */
    private String schemaName;

    /**
     * 模糊搜索词
     */
    private String searchKey;

    /**
     * if true, refresh the cache
     */
    private boolean refresh;
}
