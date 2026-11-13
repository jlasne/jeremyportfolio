/* jeremylasne.com/workout: the top sets of each week, given by hand in a
   Claude Code chat and added here, one week per line. Each set is [kg, reps]; pull-up
   and dips count the weight added. The page adds them to the log's sets:
   the maxes, the chart and the table read both. */
export const RECORD = {
  1: { squat: [[90, 1]], dip: [[50, 1]], 'pull-up': [[32.5, 1]], deadlift: [[130, 1]], bench: [[90, 1]] },
  2: { squat: [[90, 3]], dip: [[30, 3]], 'pull-up': [[20, 3]], deadlift: [[100, 3]], bench: [[80, 3]] },
  3: { squat: [[80, 5]], dip: [[20, 5]], 'pull-up': [[12.5, 5]], deadlift: [[90, 5]], bench: [[70, 5]] },
  4: { 'pull-up': [[15, 5], [11.25, 7]], deadlift: [[100, 5], [90, 7]] }, /* pull, 13 Nov */
};
