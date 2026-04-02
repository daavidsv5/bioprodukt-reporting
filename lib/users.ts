import fs from 'fs';
import path from 'path';

export interface User {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: 'admin' | 'user';
  createdAt: string;
}

export type PublicUser = Omit<User, 'passwordHash'>;

function readUsers(): User[] {
  const filePath = path.join(process.cwd(), 'data', 'users.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as User[];
}

function writeUsers(users: User[]): void {
  const filePath = path.join(process.cwd(), 'data', 'users.json');
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2), 'utf-8');
}

export async function getUsers(): Promise<User[]> {
  return readUsers();
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const users = readUsers();
  return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export async function getUserById(id: string): Promise<User | undefined> {
  const users = readUsers();
  return users.find(u => u.id === id);
}

export async function addUser(user: User): Promise<void> {
  const users = readUsers();
  users.push(user);
  writeUsers(users);
}

export async function deleteUser(id: string): Promise<void> {
  const users = readUsers().filter(u => u.id !== id);
  writeUsers(users);
}

export async function updatePassword(id: string, newHash: string): Promise<void> {
  const users = readUsers().map(u =>
    u.id === id ? { ...u, passwordHash: newHash } : u
  );
  writeUsers(users);
}
