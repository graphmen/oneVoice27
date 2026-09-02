export type Verse = {
  id: string;
  reference: string;
  text: string;
  image: string;
  theme: string;
};

export const VERSES: Verse[] = [
  {
    id: "john-10-11",
    reference: "John 10:11",
    text: "I am the good shepherd: the good shepherd giveth his life for the sheep.",
    image: "/verses/verse-01.jpg",
    theme: "The Good Shepherd",
  },
  {
    id: "john-10-14",
    reference: "John 10:14",
    text: "I am the good shepherd, and know my sheep, and am known of mine.",
    image: "/verses/verse-02.jpg",
    theme: "He Knows His Sheep",
  },
  {
    id: "matt-16-16",
    reference: "Matthew 16:16",
    text: "And Simon Peter answered and said, Thou art the Christ, the Son of the living God.",
    image: "/verses/verse-03.jpg",
    theme: "The Messiah",
  },
  {
    id: "john-15-5",
    reference: "John 15:5",
    text: "I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.",
    image: "/verses/verse-04.jpg",
    theme: "The Vine and Branches",
  },
  {
    id: "john-10-9",
    reference: "John 10:9",
    text: "I am the door: by me if any man enter in, he shall be saved, and shall go in and out, and find pasture.",
    image: "/verses/verse-05.jpg",
    theme: "The Door",
  },
  {
    id: "john-15-1",
    reference: "John 15:1",
    text: "I am the true vine, and my Father is the husbandman.",
    image: "/verses/verse-06.jpg",
    theme: "The True Vine",
  },
  {
    id: "john-15-13",
    reference: "John 15:13",
    text: "Greater love hath no man than this, that a man lay down his life for his friends.",
    image: "/verses/verse-07.jpg",
    theme: "Greater Love",
  },
  {
    id: "john-6-35",
    reference: "John 6:35",
    text: "And Jesus said unto them, I am the bread of life: he that cometh to me shall never hunger; and he that believeth on me shall never thirst.",
    image: "/verses/verse-08.jpg",
    theme: "Bread of Life",
  },
  {
    id: "john-11-25",
    reference: "John 11:25",
    text: "Jesus said unto her, I am the resurrection, and the life: he that believeth in me, though he were dead, yet shall he live.",
    image: "/verses/verse-09.jpg",
    theme: "Resurrection",
  },
  {
    id: "john-14-6",
    reference: "John 14:6",
    text: "Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.",
    image: "/verses/verse-10.jpg",
    theme: "The Way",
  },
  {
    id: "phil-2-11",
    reference: "Philippians 2:11",
    text: "And that every tongue should confess that Jesus Christ is Lord, to the glory of God the Father.",
    image: "/verses/verse-11.jpg",
    theme: "One Voice",
  },
  {
    id: "john-8-24",
    reference: "John 8:24",
    text: "I said therefore unto you, that ye shall die in your sins: for if ye believe not that I am he, ye shall die in your sins.",
    image: "/verses/verse-12.jpg",
    theme: "I AM He",
  },
  {
    id: "1-peter-2-24",
    reference: "1 Peter 2:24",
    text: "Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.",
    image: "/verses/verse-13.jpg",
    theme: "By His Stripes",
  },
  {
    id: "john-10-7",
    reference: "John 10:7",
    text: "Then said Jesus unto them again, Verily, verily, I say unto you, I am the door of the sheep.",
    image: "/verses/verse-14.jpg",
    theme: "Door of the Sheep",
  },
  {
    id: "col-1-17",
    reference: "Colossians 1:17",
    text: "And he is before all things, and by him all things consist.",
    image: "/verses/verse-15.jpg",
    theme: "Before All Things",
  },
  {
    id: "rev-19-16",
    reference: "Revelation 19:16",
    text: "And he hath on his vesture and on his thigh a name written, KING OF KINGS, AND LORD OF LORDS.",
    image: "/verses/verse-16.jpg",
    theme: "King of Kings",
  },
  {
    id: "john-3-16",
    reference: "John 3:16",
    text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.",
    image: "/verses/verse-17.jpg",
    theme: "For God So Loved",
  },
  {
    id: "heb-12-2",
    reference: "Hebrews 12:2",
    text: "Looking unto Jesus the author and finisher of our faith; who for the joy that was set before him endured the cross, despising the shame, and is set down at the right hand of the throne of God.",
    image: "/verses/verse-18.jpg",
    theme: "Author and Finisher",
  },
  {
    id: "john-8-24-word",
    reference: "John 8:24",
    text: "I said therefore unto you, that ye shall die in your sins: for if ye believe not that I am he, ye shall die in your sins.",
    image: "/verses/verse-19.jpg",
    theme: "The Living Word",
  },
  {
    id: "rev-5-12",
    reference: "Revelation 5:12",
    text: "Saying with a loud voice, Worthy is the Lamb that was slain to receive power, and riches, and wisdom, and strength, and honour, and glory, and blessing.",
    image: "/verses/verse-20.jpg",
    theme: "Worthy is the Lamb",
  },
  {
    id: "isa-9-6",
    reference: "Isaiah 9:6–7",
    text: "For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.",
    image: "/verses/verse-21.jpg",
    theme: "Prince of Peace",
  },
  {
    id: "john-6-48",
    reference: "John 6:48",
    text: "I am that bread of life.",
    image: "/verses/verse-22.jpg",
    theme: "Bread of Life",
  },
  {
    id: "john-1-29",
    reference: "John 1:29",
    text: "The next day John seeth Jesus coming unto him, and saith, Behold the Lamb of God, which taketh away the sin of the world.",
    image: "/verses/verse-23.jpg",
    theme: "Lamb of God",
  },
];

export const VERSE_GALLERY = VERSES.map((v) => v.image);

export function verseOfTheDay(date = new Date()) {
  const start = new Date(date.getFullYear(), 0, 0);
  const day = Math.floor((date.getTime() - start.getTime()) / 86_400_000);
  return VERSES[day % VERSES.length];
}
