import React from 'react';
import { IssuesKanban } from '../issues/IssuesKanban';

/**
 * Issues Manager
 * 管理項目任務和問題（TODO/DOING/DONE）
 * 使用 Trello 風格的看板視圖
 */
export const IssuesManager: React.FC = () => {
  return <IssuesKanban />;
};
