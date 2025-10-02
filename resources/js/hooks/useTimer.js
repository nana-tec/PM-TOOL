import { humanReadableTime } from "@/utils/timer";
import { useInterval } from "@mantine/hooks";
import dayjs from "dayjs";
import { useEffect, useState } from "react";
import { usePage } from "@inertiajs/react";

export default function useTimer(task) {
  const [timerValue, setTimerValue] = useState("");
  const {
    auth: { user },
  } = usePage().props;

  const isTimerRunning = (timeLog) => {
    return timeLog.minutes === null && timeLog.timer_start !== null;
  };

  // Only consider current user's running timer
  const findMyRunningTimer = () =>
    task.time_logs.find((timeLog) => isTimerRunning(timeLog) && timeLog.user_id === user.id);

  const [runningTimer, setRunningTimer] = useState(findMyRunningTimer());

  const timerTick = () => {
    if (runningTimer) {
      const minutes = Math.round((dayjs().unix() - runningTimer.timer_start) / 60);
      setTimerValue(humanReadableTime(minutes));
    }
  };

  const timerInterval = useInterval(timerTick, 1000);

  useEffect(() => {
    const timer = findMyRunningTimer();
    setRunningTimer(timer);

    if (timer) {
      timerTick();
      timerInterval.start();
    } else {
      setTimerValue("");
      timerInterval.stop();
    }
    return timerInterval.stop;
    // Include only task.time_logs in deps; runningTimer is derived
  }, [task.time_logs]);

  return { timerValue, setTimerValue, isTimerRunning, runningTimer };
}
