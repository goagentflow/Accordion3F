import { useCallback, useEffect, useState } from 'react';
import { GANTT_CONFIG } from '../components/ganttUtils';
import { countWorkingDays } from '../components/ganttUtils';
import { getNextWorkingDay as getNextWorkingDayStrict, isNonWorkingDay, getPreviousWorkingDay, safeToISOString } from '../utils/dateHelpers';

type DragMode = 'resize-left' | 'resize-right' | 'move' | null;

interface UseGanttDragOptions {
  tasks: any[];
  bankHolidays: string[];
  onTaskMove?: (taskId: string, newStartISO: string, assetType?: string, taskName?: string) => void;
  onTaskDurationChange: (taskId: string, newDuration: number, newEndISO?: string) => void;
}

interface UseGanttDragAPI {
  isDragging: boolean;
  draggedTaskId: string | null;
  dragMode: DragMode;
  moveDaysDelta: number;
  handleMouseDown: (
    e: MouseEvent | React.MouseEvent,
    taskId: string,
    taskStart: string,
    taskEnd: string,
    mode: 'resize-left' | 'resize-right' | 'move'
  ) => void;
}

export const useGanttDrag = ({
  tasks,
  bankHolidays,
  onTaskMove,
  onTaskDurationChange
}: UseGanttDragOptions): UseGanttDragAPI => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [dragMode, setDragMode] = useState<DragMode>(null);
  const [originalStartDate, setOriginalStartDate] = useState<Date | null>(null);
  const [moveDaysDelta, setMoveDaysDelta] = useState(0);

  // Use dateHelpers; keep same-day if already working, else move to next working day
  const _getNextWorkingDay = useCallback((date: Date) => {
    if (!isNonWorkingDay(date, bankHolidays)) return date;
    return getNextWorkingDayStrict(date, bankHolidays);
  }, [bankHolidays]);

  const handleMouseDown = useCallback((e: any, taskId: string, taskStart: string, _taskEnd: string, mode: 'resize-left' | 'resize-right' | 'move') => {
    e.preventDefault();
    e.stopPropagation();
    const task = tasks.find(t => t.id === taskId);
    if (task && !task.isLiveTask) {
      setIsDragging(true);
      setDraggedTaskId(taskId);
      setDragStartX((e as MouseEvent).clientX);
      setOriginalDuration(task.duration);
      setDragMode(mode);
      setOriginalStartDate(new Date(taskStart));

      if (mode === 'move') {
        document.body.style.cursor = 'move';
      } else if (mode === 'resize-left') {
        document.body.style.cursor = 'w-resize';
      } else {
        document.body.style.cursor = 'e-resize';
      }
    }
  }, [tasks]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggedTaskId || !dragMode) return;

    const deltaX = e.clientX - dragStartX;
    const daysDelta = Math.round(deltaX / GANTT_CONFIG.DAY_COLUMN_WIDTH);
    if (daysDelta === 0) return;

    const task = tasks.find(t => t.id === draggedTaskId);
    if (!task) return;

    if (dragMode === 'move') {
      setMoveDaysDelta(daysDelta);
      return;
    }

    if (dragMode === 'resize-right') {
      // Working-day aware right-edge resize
      const startDate = new Date(task.start);
      // Propose a new end date by shifting calendar days relative to current span
      const currentSpanCalendarDays = Math.max(1, originalDuration); // originalDuration ~ working days; treat as span baseline
      const proposedEnd = new Date(startDate.getTime() + ((currentSpanCalendarDays - 1 + daysDelta) * 24 * 60 * 60 * 1000));
      // Snap end to previous working day if lands on non-working day
      let snappedEnd = new Date(proposedEnd);
      if (isNonWorkingDay(snappedEnd, bankHolidays)) {
        snappedEnd = getPreviousWorkingDay(snappedEnd, bankHolidays);
      }
      // Recompute duration as working days inclusive
      let newDuration = countWorkingDays(startDate, snappedEnd, bankHolidays);
      newDuration = Math.max(1, Math.min(365, newDuration));
      if (newDuration !== task.duration) {
        onTaskDurationChange(draggedTaskId, newDuration);
      }
      return;
    }

    if (dragMode === 'resize-left') {
      const endDate = new Date(task.end);
      const baseStart = originalStartDate ? originalStartDate : new Date(task.start);
      const proposedStart = new Date(baseStart.getTime() + (daysDelta * 24 * 60 * 60 * 1000));
      const snappedStart = _getNextWorkingDay(proposedStart);
      let newDuration = countWorkingDays(snappedStart, endDate, bankHolidays);
      newDuration = Math.max(1, Math.min(365, newDuration));
      if (newDuration !== task.duration) {
        onTaskDurationChange(draggedTaskId, newDuration);
      }
      return;
    }
  }, [isDragging, draggedTaskId, dragMode, dragStartX, tasks, originalDuration, onTaskDurationChange, onTaskMove, originalStartDate, bankHolidays, _getNextWorkingDay]);

  const handleMouseUp = useCallback(() => {
    document.body.style.cursor = 'default';
    // Commit move on mouseup
    if (isDragging && draggedTaskId && dragMode === 'move' && moveDaysDelta !== 0) {
      const task = tasks.find(t => t.id === draggedTaskId);
      if (task && onTaskMove) {
        const baseStart = originalStartDate ? originalStartDate : new Date(task.start);
        const proposedStart = new Date(baseStart.getTime() + (moveDaysDelta * 24 * 60 * 60 * 1000));
        const snappedStart = _getNextWorkingDay(proposedStart);
        onTaskMove(draggedTaskId, safeToISOString(snappedStart), task.assetType, task.name);
      }
    }
    setIsDragging(false);
    setDraggedTaskId(null);
    setDragStartX(0);
    setOriginalDuration(0);
    setDragMode(null);
    setOriginalStartDate(null);
    setMoveDaysDelta(0);
  }, [isDragging, draggedTaskId, dragMode, moveDaysDelta, tasks, onTaskMove, originalStartDate, _getNextWorkingDay]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (evt: MouseEvent) => handleMouseMove(evt);
    const onUp = () => handleMouseUp();
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return {
    isDragging,
    draggedTaskId,
    dragMode,
    moveDaysDelta,
    handleMouseDown
  };
};

export default useGanttDrag;
