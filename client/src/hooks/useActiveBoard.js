import { useCallback, useState } from 'react';

export default function useActiveBoard() {
  const [selectedBoardId, setSelectedBoardId] = useState('');
  const [activeBoard, setActiveBoard] = useState(null);
  const [columns, setColumns] = useState([]);
  const [boardMembers, setBoardMembers] = useState([]);
  const [selectedCardId, setSelectedCardId] = useState('');
  const [selectedCard, setSelectedCard] = useState(null);
  const [comments, setComments] = useState([]);
  const [cardActivity, setCardActivity] = useState([]);

  const moveCardInState = useCallback((cardId, targetColumnId, targetPosition, updatedCard) => {
    setColumns((currentColumns) => {
      let movedCard = updatedCard || null;
      const columnsWithoutCard = currentColumns.map((column) => {
        const remainingCards = column.cards.filter((card) => {
          if (card.id === cardId) {
            movedCard = updatedCard || { ...card, columnId: targetColumnId };
            return false;
          }

          return true;
        });

        return { ...column, cards: remainingCards };
      });

      if (!movedCard) {
        return currentColumns;
      }

      return columnsWithoutCard.map((column) => {
        if (column.id !== targetColumnId) {
          return column;
        }

        const nextCards = [...column.cards];
        const insertAt = Math.max(0, Math.min(targetPosition, nextCards.length));
        nextCards.splice(insertAt, 0, { ...movedCard, columnId: targetColumnId });

        return {
          ...column,
          cards: nextCards.map((card, index) => ({ ...card, position: index }))
        };
      });
    });
  }, []);

  const mergeCardInState = useCallback((updatedCard) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        cards: column.cards.map((card) =>
          card.id === updatedCard.id ? { ...card, ...updatedCard } : card
        )
      }))
    );
  }, []);

  const removeCardFromState = useCallback((cardId) => {
    setColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        cards: column.cards
          .filter((card) => card.id !== cardId)
          .map((card, index) => ({ ...card, position: index }))
      }))
    );
  }, []);

  const mergeCardActivity = useCallback((activity) => {
    if (!activity) return;

    setCardActivity((currentActivity) => [
      activity,
      ...currentActivity.filter((item) => item.id !== activity.id)
    ]);
  }, []);

  const resetActiveBoard = useCallback(() => {
    setSelectedBoardId('');
    setActiveBoard(null);
    setColumns([]);
    setBoardMembers([]);
    setSelectedCardId('');
    setSelectedCard(null);
    setComments([]);
    setCardActivity([]);
  }, []);

  return {
    selectedBoardId,
    setSelectedBoardId,
    activeBoard,
    setActiveBoard,
    columns,
    setColumns,
    boardMembers,
    setBoardMembers,
    selectedCardId,
    setSelectedCardId,
    selectedCard,
    setSelectedCard,
    comments,
    setComments,
    cardActivity,
    setCardActivity,
    moveCardInState,
    mergeCardInState,
    removeCardFromState,
    mergeCardActivity,
    resetActiveBoard
  };
}
