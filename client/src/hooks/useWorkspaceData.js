import { useCallback, useEffect, useState } from 'react';
import { getBoards, getWorkspaceActivity, getWorkspaceStats } from '../api/workspaceApi.js';

const emptyWorkspaceStats = {
  boards: { total: 0, owned: 0, shared: 0 },
  cards: { total: 0, completed: 0, completedThisWeek: 0 },
  checklist: { total: 0, completed: 0 },
  velocity: 0,
  storage: { usedPercent: 0, usedLabel: '0 GB', limitLabel: '20 GB' }
};

export default function useWorkspaceData(token, user) {
  const [boards, setBoards] = useState([]);
  const [boardsError, setBoardsError] = useState('');
  const [isLoadingBoards, setIsLoadingBoards] = useState(false);
  const [workspaceStats, setWorkspaceStats] = useState(emptyWorkspaceStats);
  const [workspaceActivity, setWorkspaceActivity] = useState([]);

  const loadWorkspaceOverview = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const [statsData, activityData] = await Promise.all([
        getWorkspaceStats(token),
        getWorkspaceActivity(token)
      ]);
      setWorkspaceStats(statsData.stats || emptyWorkspaceStats);
      setWorkspaceActivity(activityData.activity || []);
    } catch (error) {
      setBoardsError(error.message);
    }
  }, [token]);

  const loadBoards = useCallback(async () => {
    if (!token) {
      return;
    }

    setBoardsError('');
    setIsLoadingBoards(true);

    try {
      const data = await getBoards(token);
      setBoards(data.boards);
      await loadWorkspaceOverview();
    } catch (error) {
      setBoardsError(error.message);
    } finally {
      setIsLoadingBoards(false);
    }
  }, [token, loadWorkspaceOverview]);

  const resetWorkspace = useCallback(() => {
    setBoards([]);
    setBoardsError('');
    setWorkspaceStats(emptyWorkspaceStats);
    setWorkspaceActivity([]);
  }, []);

  useEffect(() => {
    if (user && token) {
      loadBoards();
    } else {
      resetWorkspace();
    }
  }, [user, token, loadBoards, resetWorkspace]);

  return {
    boards,
    setBoards,
    boardsError,
    setBoardsError,
    isLoadingBoards,
    workspaceStats,
    workspaceActivity,
    loadBoards,
    loadWorkspaceOverview,
    resetWorkspace
  };
}
