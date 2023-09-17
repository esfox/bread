import { incrementalNumber, randFullName, randParagraph } from '@ngneat/falso';

export const mockId = incrementalNumber();

export const mockData = new Array(10).fill(0).map((_, i) => ({
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
