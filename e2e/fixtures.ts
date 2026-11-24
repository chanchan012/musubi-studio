export const ALICE = "e2e_alice";
export const BOB = "e2e_bob";
export const DECK = "00000000-0000-4000-8000-00000000d001";
export const POST = "00000000-0000-4000-8000-00000000c001";
export const mcqIds = [1, 2, 3].map((n) => `00000000-0000-4000-8000-0000000000${n}1`);
export const cardIds = [1, 2].map((n) => `00000000-0000-4000-8000-0000000001${n}1`);
export const asUser = (id: string) => ({ name: "e2e_user", value: id, url: "http://localhost:3100" });
