import React, { ChangeEvent, useEffect, useState } from 'react';
import styles from './index.less';
import AIImg from '@/assets/img/ai.svg';
import { Checkbox, Dropdown, Input, Modal, Popover, Select } from 'antd';
import i18n from '@/i18n/';
import Iconfont from '@/components/Iconfont';
import { WarningOutlined } from '@ant-design/icons';
import { IRemainingUse } from '@/typings/ai';
import { WECHAT_MP_URL } from '@/constants/social';

interface IProps {
  value?: string;
  result?: string;
  tables?: string[];
  selectedTables?: string[];
  remainingUse?: IRemainingUse;
  onPressEnter: (value: string) => void;
  onSelectTables?: (tables: string[]) => void;
  onClickRemainBtn: Function;
}

function ChatInput(props: IProps) {
  const onPressEnter = (e: any) => {
    if (!e.target.value) {
      return;
    }
    if (e.nativeEvent.isComposing && e.key === 'Enter') {
      e.preventDefault();
      return;
    }
    props.onPressEnter && props.onPressEnter(e.target.value);
  };

  const onCheckAllTables = (e: any) => {
    const { tables, onSelectTables } = props;
    if (e.target.checked) {
      onSelectTables(tables);
    } else {
      onSelectTables([]);
    }
  };

  const renderSelectTable = () => {
    const { tables, selectedTables, onSelectTables } = props;
    const options = (tables || []).map((t) => ({ value: t, label: t }));
    return (
      <div className={styles.aiSelectedTable}>
        <span className={styles.aiSelectedTableTips}>
          {/* <WarningOutlined style={{color: 'yellow'}}/> */}
          {i18n('chat.input.remain.tooltip')}
        </span>
        <Checkbox defaultChecked={true} onChange={onCheckAllTables}>Check all</Checkbox>
        <Select
          showSearch
          mode="multiple"
          size="large"
          allowClear
          options={options}
          placeholder={i18n('chat.input.tableSelect.placeholder')}
          value={selectedTables}
          onChange={(v) => {
            onSelectTables && onSelectTables(v);
          }}
        />
      </div>
    );
  };

  const renderSuffix = () => {
    const remainCnt = props?.remainingUse?.remainingUses ?? '-';
    return (
      <div className={styles.suffixBlock}>
        {/* show selected tables */}
        <div className={styles.tableSelectBlock}>
          <Popover content={renderSelectTable()} placement="bottom" trigger="click">
            <Iconfont code="&#xe618;" />
          </Popover>
        </div>

        {/*
        <div
          className={styles.remainBlock}
          onClick={() => {
            props.onClickRemainBtn && props.onClickRemainBtn();
          }}
        >
          {i18n('chat.input.remain', remainCnt)}
        </div>
        */}
      </div>
    );
  };

  return (
    <div className={styles.chatWrapper}>
      <img className={styles.chatAi} src={AIImg} />
      <Input
        defaultValue={props.value}
        bordered={false}
        placeholder={i18n('workspace.ai.input.placeholder')}
        // onKeyUp={onPressEnter}
        onPressEnter={onPressEnter}
        suffix={renderSuffix()}
      />
    </div>
  );
}

export default ChatInput;
