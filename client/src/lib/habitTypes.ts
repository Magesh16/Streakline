import { BookOpen, Bike, Brain, Code2, Droplets, Dumbbell, Footprints, GraduationCap, Heart, Languages, Music, PenLine, Target, type LucideIcon } from 'lucide-react';
import type { Habit, HabitType } from '../types';

export const TYPE_META: Record<HabitType, { label: string; hint: string; Icon: LucideIcon; placeholder: string }> = {
  custom: { label: 'Just time', hint: 'Log minutes and a note', Icon: Target, placeholder: 'Notes…' },
  gym: { label: 'Workout', hint: 'Also log the workout type (push, pull, legs…)', Icon: Dumbbell, placeholder: 'How did it go? PRs, how you felt…' },
  dsa: { label: 'Problem solving', hint: 'Also log problem, difficulty, topic and solved', Icon: Code2, placeholder: 'Approach, mistakes, what to revisit…' },
  skill: { label: 'Learning', hint: 'Log minutes and what you learned', Icon: GraduationCap, placeholder: 'What did you learn or build?' },
};

export const ICONS: Record<string, LucideIcon> = {
  target: Target,
  dumbbell: Dumbbell,
  code: Code2,
  learn: GraduationCap,
  book: BookOpen,
  brain: Brain,
  heart: Heart,
  run: Footprints,
  bike: Bike,
  pen: PenLine,
  music: Music,
  language: Languages,
  water: Droplets,
};
const TYPE_DEFAULT_ICON: Record<HabitType, string> = { custom: 'target', gym: 'dumbbell', dsa: 'code', skill: 'learn' };
export const iconFor = (h: Pick<Habit, 'type' | 'icon'>): LucideIcon => ICONS[h.icon ?? ''] ?? ICONS[TYPE_DEFAULT_ICON[h.type]];

export interface Template {
  name: string;
  type: HabitType;
  icon: string;
  color: string;
  daysPerWeek: number;
  minutesPerDay: number;
}
export const TEMPLATES: Template[] = [
  { name: 'Gym', type: 'gym', icon: 'dumbbell', color: '#ff7a59', daysPerWeek: 5, minutesPerDay: 60 },
  { name: 'DSA practice', type: 'dsa', icon: 'code', color: '#2dd4a7', daysPerWeek: 6, minutesPerDay: 45 },
  { name: 'Skill upgrade', type: 'skill', icon: 'learn', color: '#7c8cff', daysPerWeek: 5, minutesPerDay: 45 },
  { name: 'Reading', type: 'custom', icon: 'book', color: '#f5b83d', daysPerWeek: 7, minutesPerDay: 20 },
  { name: 'Meditation', type: 'custom', icon: 'brain', color: '#c084fc', daysPerWeek: 7, minutesPerDay: 10 },
  { name: 'Running', type: 'custom', icon: 'run', color: '#38bdf8', daysPerWeek: 4, minutesPerDay: 30 },
  { name: 'Writing', type: 'custom', icon: 'pen', color: '#f472b6', daysPerWeek: 5, minutesPerDay: 30 },
  { name: 'Language practice', type: 'custom', icon: 'language', color: '#94a3b8', daysPerWeek: 6, minutesPerDay: 20 },
];

export const GYM_SPLITS = ['Push', 'Pull', 'Legs', 'Upper', 'Lower', 'Full body', 'Cardio', 'Other'];
export const DSA_TOPICS = ['Arrays', 'Strings', 'Hashing', 'Two pointers', 'Sliding window', 'Linked list', 'Stack/Queue', 'Trees', 'Graphs', 'DP', 'Greedy', 'Backtracking', 'Binary search', 'Heap', 'Math'];
export const COLORS = ['#ff7a59', '#f5b83d', '#2dd4a7', '#38bdf8', '#7c8cff', '#c084fc', '#f472b6', '#94a3b8'];
export const PRESET_MINUTES = [10, 20, 30, 45, 60, 90];
