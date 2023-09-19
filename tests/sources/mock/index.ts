import { incrementalNumber, randFullName, randParagraph } from '@ngneat/falso';

type MockRecord = {
  id: number;
  name: string;
  description: string;
  direction: 'left' | 'right';
};

export const mockId = incrementalNumber();

export const mockData: MockRecord[] = new Array(10).fill(0).map((_, i) => ({
  id: mockId(),
  name: randFullName(),
  description: randParagraph(),
  direction: i % 2 === 0 ? 'left' : 'right',
}));

mockData.push({
  id: mockId(),
  name: 'there is foobar in this name',
  description: randParagraph(),
  direction: 'left',
});

mockData.push({
  id: mockId(),
  name: randFullName(),
  description: 'there is foobar in this description',
  direction: 'right',
});

mockData.push({
  id: mockId(),
  name: randFullName(),
  description: 'there is foobar in this description',
  direction: 'left',
});

export const mockRecord1 = mockData[0];
export const mockRecord2 = mockData[1];

export function createNewMockRecord() {
  const newMockRecord: Partial<MockRecord> = {
    id: mockId(),
    name: randFullName(),
    description: randParagraph(),
    direction: Math.random() > 0.5 ? 'left' : 'right',
  };

  return newMockRecord;
}
