import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase letters, numbers and hyphens only');

// v0.95.0 (push part 7e-1): the notification text must not hold an emoji (PLAN 29.3 and 31.5). Same rule as scripts/no-emoji-lib.mjs and the Worker: the copyright, registered and trade mark signs are fine.
const NOTE_EMOJI = /(?![\u00A9\u00AE\u2122])(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|[\uFE0F\u20E3]|[\u{1F1E6}-\u{1F1FF}])/u;

const blogs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/blogs' }),
  schema: z
    .object({
      title: z.string().min(5),
      permalink: slug,
      category: slug,
      tags: z.array(z.string()).default([]),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      author: slug.default('shivam-das'),
      // Drafts may be saved without a description (the dashboard saves early); publishing needs 50 to 160 characters.
      description: z.string().max(160).default(''),
      metaTitle: z.string().default(''),
      focusKeyword: z.string().default(''),
      image: z.string().optional(),
      imageAlt: z.string().optional(),
      imageCredit: z.string().default(''),
      keyPoints: z.array(z.string()).default([]),
      canonical: z.string().default(''),
      // v0.101.21 (PLAN 33.2 Advanced fold): share card (Open Graph). Empty = use the page title, the description and the featured image.
      ogTitle: z.string().max(70).default(''),
      ogDescription: z.string().max(320).default(''),
      ogImage: z.string().default(''),
      robots: z.string().default('index,follow'),
      // v0.70.0: optional. Leave empty and the place is found automatically; ["none"] switches it off. Up to 3 names.
      location: z.array(z.string()).max(3).default([]),
      schemaType: z.enum(['NewsArticle', 'Article', 'BlogPosting']).default('NewsArticle'),
      breaking: z.boolean().default(false),
      featured: z.boolean().default(false),
      trending: z.boolean().default(false),
      autoLinks: z.boolean().default(true),
      ads: z.object({ hideAll: z.boolean().default(false), hidePopunder: z.boolean().default(false) }).default({}),
      redirects: z.array(z.string()).default([]),
      status: z.enum(['draft', 'scheduled', 'published', 'archived']).default('draft'),
      // v0.95.0 (push part 7e-1, PLAN 31.5): auto = the algorithm decides, off = never notify, force = skip only the importance part.
      // pushTitle (up to 70) and pushBody (up to 120) replace the headline and the description in the notification when they are filled.
      push: z.enum(['auto', 'off', 'force']).default('auto'),
      pushTitle: z.string().max(70).default(''),
      pushBody: z.string().max(120).default(''),
    })
    // Pre-publish gate (LOGICS.md section 13)
    .refine((d) => d.status !== 'published' || (d.image && d.imageAlt), {
      message: 'Published posts need image and imageAlt',
    })
    .refine((d) => d.status !== 'published' || d.description.length >= 50, {
      message: 'Published posts need a description of 50 to 160 characters',
    })
    .refine((d) => !NOTE_EMOJI.test(`${d.pushTitle} ${d.pushBody}`), {
      message: 'The notification text (pushTitle, pushBody) must not contain emoji',
    }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages' }),
  schema: z.object({
    title: z.string().min(2),
    permalink: slug,
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string().max(160).default(''),
    // v0.101.26 (PLAN 33.2, Part 6d): own search title and description. Empty = use the page title and the description.
    metaTitle: z.string().max(70).default(''),
    metaDescription: z.string().max(320).default(''),
    status: z.enum(['draft', 'published']).default('draft'),
  }),
});

const authors = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './content/authors' }),
  schema: z.object({
    name: z.string(),
    bio: z.string().default(''),
    photo: z.string().optional(),
    metaTitle: z.string().max(70).optional(),
    metaDescription: z.string().max(320).optional(),
    links: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
  }),
});

export const collections = { blogs, pages, authors };
