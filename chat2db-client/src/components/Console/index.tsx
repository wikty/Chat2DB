import React, { useEffect, useMemo, useRef, useState } from 'react';
import { connect } from 'umi';
import { formatParams } from '@/utils/common';
import connectToEventSource from '@/utils/eventSource';
import { Button, Spin, message, Drawer, Modal } from 'antd';
import ChatInput from './ChatInput';
import Editor, { IEditorOptions, IExportRefFunction, IRangeType } from './MonacoEditor';
import { format } from 'sql-formatter';
import sqlServer from '@/service/sql';
import historyServer from '@/service/history';
import aiServer from '@/service/ai';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseTypeCode, ConsoleStatus } from '@/constants';
import Iconfont from '../Iconfont';
import { ITreeNode } from '@/typings';
import { IAIState } from '@/models/ai';
import Popularize from '@/components/Popularize';
import { handleLocalStorageSavedConsole, readLocalStorageSavedConsoleText } from '@/utils';
import { chatErrorCodeArr, chatErrorToInvite, chatErrorToLogin } from '@/constants/chat';
import { AiSqlSourceType } from '@/typings/ai';
import i18n from '@/i18n';
import styles from './index.less';

enum IPromptType {
  NL_2_SQL = 'NL_2_SQL',
  SQL_EXPLAIN = 'SQL_EXPLAIN',
  SQL_OPTIMIZER = 'SQL_OPTIMIZER',
  SQL_2_SQL = 'SQL_2_SQL',
  ChatRobot = 'ChatRobot',
}

enum IPromptTypeText {
  NL_2_SQL = '自然语言转换',
  SQL_EXPLAIN = '解释SQL',
  SQL_OPTIMIZER = 'SQL优化',
  SQL_2_SQL = 'SQL转换',
  ChatRobot = 'Chat机器人',
}

export type IAppendValue = {
  text: any;
  range?: IRangeType;
};

interface IProps {
  /** 是谁在调用我 */
  source: 'workspace';
  /** 是否是活跃的console，用于快捷键 */
  isActive?: boolean;
  /** 添加或修改的内容 */
  appendValue?: IAppendValue;
  defaultValue?: string;
  /** 是否开启AI输入 */
  hasAiChat: boolean;
  /** 是否可以开启SQL转到自然语言的相关ai操作 */
  hasAi2Lang?: boolean;
  /** 是否有 */
  hasSaveBtn?: boolean;
  value?: string;
  executeParams: {
    databaseName?: string;
    dataSourceId?: number;
    type?: DatabaseTypeCode;
    consoleId?: number;
    schemaName?: string;
    consoleName?: string;
  };
  tableList?: ITreeNode[];
  editorOptions?: IEditorOptions;
  aiModel: IAIState;
  dispatch: Function;
  // remainingUse: IAIState['remainingUse'];
  // onSQLContentChange: (v: string) => void;
  onExecuteSQL: (result: any, sql: string, createHistoryParams) => void;
  onConsoleSave: () => void;
  tables: any[];
}

function Console(props: IProps) {
  const {
    hasAiChat = true,
    executeParams,
    appendValue,
    isActive,
    hasSaveBtn = true,
    value,
    aiModel,
    dispatch,
    source,
    defaultValue,
  } = props;
  const uid = useMemo(() => uuidv4(), []);
  const chatResult = useRef('');
  const editorRef = useRef<IExportRefFunction>();
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiContent, setAiContent] = useState('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isAiDrawerLoading, setIsAiDrawerLoading] = useState(false);
  const monacoHint = useRef<any>();
  const [modal, contextHolder] = Modal.useModal();
  const [popularizeModal, setPopularizeModal] = useState(false);
  const [modalProps, setModalProps] = useState({});
  const timerRef = useRef<any>();
  const aiFetchIntervalRef = useRef<any>();

  useEffect(() => {
    if (appendValue) {
      editorRef?.current?.setValue(appendValue.text, appendValue.range);
    }
  }, [appendValue]);

  useEffect(() => {
    monacoHint.current?.dispose();
    const myEditorHintData: any = {};
    props.tables?.map((item: any) => {
      myEditorHintData[item.name] = [];
    });
    monacoHint.current = editorRef?.current?.handleRegisterTigger(myEditorHintData);
  }, [props.tables]);

  useEffect(() => {
    if (source !== 'workspace') {
      return;
    }
    // 离开时保存
    if (!isActive) {
      // 离开时清除定时器
      if (timerRef.current) {
        clearInterval(timerRef.current);
        handleLocalStorageSavedConsole(executeParams.consoleId!, 'save', editorRef?.current?.getAllContent());
      }
    } else {
      // 活跃时自动保存
      timingAutoSave();
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isActive]);

  useEffect(() => {
    if (source !== 'workspace') {
      return;
    }
    const value = readLocalStorageSavedConsoleText(executeParams.consoleId!);
    if (value) {
      editorRef?.current?.setValue(value, 'reset');
    }
  }, []);

  function timingAutoSave() {
    timerRef.current = setInterval(() => {
      handleLocalStorageSavedConsole(executeParams.consoleId!, 'save', editorRef?.current?.getAllContent());
    }, 5000);
  }

  const tableListName = useMemo(() => {
    const tableList = (props.tables || []).map((t) => t.name);

    // 默认选中前八个
    //setSelectedTables(tableList.slice(0, 8));
    // 默认全部选中
    setSelectedTables(tableList);

    return tableList;
  }, [props.tables]);

  const handleApiKeyEmptyOrGetQrCode = async (shouldPoll?: boolean) => {
    setIsLoading(true);
    const { wechatQrCodeUrl, token, tip } = await aiServer.getLoginQrCode({});
    setIsLoading(false);
    // console.log('weiChatConfig', wechatQrCodeUrl, token);
    setPopularizeModal(true);
    setModalProps({
      imageUrl: wechatQrCodeUrl,
      token,
      tip,
    });
    if (shouldPoll) {
      let pollCnt = 0;
      aiFetchIntervalRef.current = setInterval(async () => {
        const { apiKey } = await aiServer.getLoginStatus({ token });
        pollCnt++;
        if (apiKey || pollCnt >= 60) {
          clearInterval(aiFetchIntervalRef.current);
        }
        if (apiKey) {
          setPopularizeModal(false);
          await dispatch({
            type: 'ai/setKeyAndAiType',
            payload: {
              key: apiKey,
              aiType: AiSqlSourceType.CHAT2DBAI,
            },
          });
          /*await dispatch({
            type: 'ai/fetchRemainingUse',
            payload: {
              key: apiKey,
            },
          });*/
        }
      }, 3000);
    }
  };

  // 处理NL2SQL，准备参数、发起请求、显示响应内容
  const handleAiChat = async (content: string, promptType: IPromptType) => {
    const { key } = aiModel?.keyAndAiType;
    if (!key) {
      handleApiKeyEmptyOrGetQrCode(true);
      return;
    }

    const { dataSourceId, databaseName, schemaName } = executeParams;
    const isNL2SQL = promptType === IPromptType.NL_2_SQL;
    if (isNL2SQL) {
      setIsLoading(true);
    } else {
      setIsAiDrawerOpen(true);
      setIsAiDrawerLoading(true);
    }
    const params = formatParams({
      message: content,
      promptType,
      dataSourceId,
      databaseName,
      schemaName,
      tableNames: selectedTables,
    });

    const handleMessage = (message: string) => {
      setIsLoading(false);

      try {
        const isEOF = message === '[DONE]';
        if (isEOF) {
          closeEventSource();
          setIsLoading(false);
          /*dispatch({
            type: 'ai/fetchRemainingUse',
            payload: {
              key,
            },
          });*/
          if (isNL2SQL) {
            editorRef?.current?.setValue('\n\n\n');
          } else {
            setIsAiDrawerLoading(false);
            chatResult.current += '\n\n\n';
            setAiContent(chatResult.current);
            chatResult.current = '';
          }
          return;
        }

        // let hasError = false;
        // chatErrorCodeArr.forEach((err) => {
        //   if (message.includes(err)) {
        //     hasError = true;
        //   }
        // });
        let hasErrorToLogin = false;
        chatErrorToLogin.forEach((err) => {
          if (message.includes(err)) {
            hasErrorToLogin = true;
          }
        });
        let hasErrorToInvite = false;
        chatErrorToInvite.forEach((err) => {
          if (message.includes(err)) {
            hasErrorToInvite = true;
          }
        });
        if (hasErrorToLogin || hasErrorToInvite) {
          closeEventSource();
          setIsLoading(false);
          hasErrorToLogin && handleApiKeyEmptyOrGetQrCode(true);
          hasErrorToInvite && handleClickRemainBtn();
          /*dispatch({
            type: 'ai/fetchRemainingUse',
            payload: {
              key,
            },
          });*/
          return;
        }

        if (isNL2SQL) {
          editorRef?.current?.setValue(JSON.parse(message).content);
        } else {
          chatResult.current += JSON.parse(message).content;
        }
      } catch (error) {
        setIsLoading(false);
      }
    };

    const handleError = (error: any) => {
      console.error('Error:', error);
      setIsLoading(false);
    };

    const closeEventSource = connectToEventSource({
      url: `/api/ai/chat?${params}`,
      uid,
      onMessage: handleMessage,
      onError: handleError,
    });
  };

  const onPressChatInput = (value: string) => {
    handleAiChat(value, IPromptType.NL_2_SQL);
  };

  const executeSQL = (sql?: string) => {
    const sqlContent = sql || editorRef?.current?.getCurrentSelectContent() || editorRef?.current?.getAllContent();

    if (!sqlContent) {
      return;
    }

    let p: any = {
      sql: sqlContent,
      ...executeParams,
    };
    sqlServer.executeSql(p).then((res) => {
      let createHistoryParams: any = {
        ...executeParams,
        ddl: sqlContent,
      };
      props.onExecuteSQL?.(res, sqlContent!, createHistoryParams);
    });
  };

  const saveConsole = (value?: string) => {
    // const a = editorRef.current?.getAllContent();
    let p: any = {
      id: executeParams.consoleId,
      status: ConsoleStatus.RELEASE,
      ddl: value,
    };

    historyServer.updateSavedConsole(p).then((res) => {
      handleLocalStorageSavedConsole(executeParams.consoleId!, 'delete');
      message.success(i18n('common.tips.saveSuccessfully'));
      props.onConsoleSave && props.onConsoleSave();
    });
  };

  const addAction = useMemo(
    () => [
      {
        id: 'explainSQL',
        label: i18n('common.text.explainSQL'),
        action: (selectedText: string) => handleAiChat(selectedText, IPromptType.SQL_EXPLAIN),
      },
      {
        id: 'optimizeSQL',
        label: i18n('common.text.optimizeSQL'),
        action: (selectedText: string) => handleAiChat(selectedText, IPromptType.SQL_OPTIMIZER),
      },
      {
        id: 'changeSQL',
        label: i18n('common.text.conversionSQL'),
        action: (selectedText: string) => handleAiChat(selectedText, IPromptType.SQL_2_SQL),
      },
    ],
    [],
  );

  const handleClickRemainBtn = async () => {
    if (
      !aiModel.keyAndAiType.key ||
      aiModel.remainingUse?.remainingUses === null ||
      aiModel.remainingUse?.remainingUses === undefined
    ) {
      handleApiKeyEmptyOrGetQrCode(true);
      return;
    }

    setIsLoading(true);
    const { tip, wechatQrCodeUrl } = await aiServer.getInviteQrCode({});
    setIsLoading(false);
    setModalProps({
      imageUrl: wechatQrCodeUrl,
      tip,
    });
    setPopularizeModal(true);
  };

  return (
    <div className={styles.console}>
      <Spin spinning={isLoading} style={{ height: '100%' }}>
        {hasAiChat && (
          <ChatInput
            tables={tableListName}
            remainingUse={aiModel.remainingUse}
            onPressEnter={onPressChatInput}
            selectedTables={selectedTables}
            onSelectTables={(tables: string[]) => {
              {/* 选择多于8张表则报警提示用户 */}
              if (tables.length > 8) {
                message.warning({
                  content: i18n('chat.input.tableSelect.error.TooManyTable'),
                });
                //return;
              }
              setSelectedTables(tables);
            }}
            onClickRemainBtn={handleClickRemainBtn}
          />
        )}
        {/* <div key={uuid()}>{chatContent.current}</div> */}

        <Editor
          id={uid}
          defaultValue={defaultValue}
          isActive={isActive}
          ref={editorRef as any}
          className={hasAiChat ? styles.consoleEditorWithChat : styles.consoleEditor}
          addAction={addAction}
          onSave={saveConsole}
          onExecute={executeSQL}
          options={props.editorOptions}
          tables={props.tables}
          // onChange={}
        />
        {/* <Modal open={modelConfig.open}>{modelConfig.content}</Modal> */}
        <Drawer open={isAiDrawerOpen} getContainer={false} mask={false} onClose={() => setIsAiDrawerOpen(false)}>
          <Spin spinning={isAiDrawerLoading} style={{ height: '100%' }}>
            <div className={styles.aiBlock}>{aiContent}</div>
          </Spin>
        </Drawer>
      </Spin>

      <div className={styles.consoleOptionsWrapper}>
        <div className={styles.consoleOptionsLeft}>
          <Button type="primary" className={styles.runButton} onClick={() => executeSQL()}>
            <Iconfont code="&#xe637;" />
            {i18n('common.button.execute')}
          </Button>
          {hasSaveBtn && (
            <Button
              type="default"
              className={styles.saveButton}
              onClick={() => saveConsole(editorRef?.current?.getAllContent())}
            >
              {i18n('common.button.save')}
            </Button>
          )}
        </div>
        <Button
          type="text"
          onClick={() => {
            const contextTmp = editorRef?.current?.getAllContent();
            editorRef?.current?.setValue(format(contextTmp || ''), 'cover');
          }}
        >
          {i18n('common.button.format')}
        </Button>
      </div>
      <Modal
        open={popularizeModal}
        footer={false}
        onCancel={() => {
          aiFetchIntervalRef.current && clearInterval(aiFetchIntervalRef.current);
          setPopularizeModal(false);
        }}
      >
        <Popularize {...modalProps} />
      </Modal>
    </div>
  );
}

const dvaModel = connect(({ ai }: { ai: IAIState }) => ({
  aiModel: ai,
}));
export default dvaModel(Console);
