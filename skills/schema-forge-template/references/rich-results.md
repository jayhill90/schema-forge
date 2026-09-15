# Property checklists by type

For each type: what Google's rich result requires (**bold**), what it recommends, and the token that usually supplies it. "Yoast" means use a `ref`. Always add `name`/`headline` with `onEmpty: dropNode`.

## Product (`webPageType: ItemPage`, `suppressArticle: true`, `isMainEntity`)
- **name** `{{post.title}}` · **image** `{{post.featured_image_object}}` (or `ref yoast:primaryimage`) · description `{{post.excerpt}}`
- **offers** → nested `Offer`: **price** `{{meta._price}}` (WooCommerce) or `{{meta.price}}`, dataType number, `onEmpty: dropNode` on the Offer · **priceCurrency** literal (`USD`) or `{{meta.currency}}` with fallback · availability `https://schema.org/InStock` (or map `{{meta._stock_status}}`) · url `{{post.permalink}}` · seller `ref yoast:organization` · priceValidUntil `{{meta.sale_ends|date:Y-m-d}}` if present
- sku `{{meta._sku}}` · gtin/mpn from meta · brand → nested `Brand` with name literal or `{{meta.brand}}`, fallback `{{site.name}}` · category `{{terms.product_cat.first.name}}` · aggregateRating → `AggregateRating` (ratingValue `{{meta._wc_average_rating}}` number, reviewCount `{{meta._wc_review_count}}` integer, both `dropNode`) only when the page shows ratings · review → `Review` nodes if reviews are visible · additionalProperty → repeat `PropertyValue` for spec tables when data lives in a repeater

## Article / BlogPosting / NewsArticle
Yoast already outputs `Article` for posts with headline, author, publisher, image, dates. Only build this template when: the site has no Yoast; a subtype is needed (`NewsArticle`, `TechArticle`, `BlogPosting`) — then `suppressArticle: true`; or to add `VideoObject`/`speakable`/`articleSection`.
- **headline** `{{post.title}}` · **image** `ref yoast:primaryimage` · **datePublished** `{{post.date}}` (datetime) · dateModified `{{post.modified}}` · **author** `ref yoast:author` · publisher `ref yoast:publisher` · description `{{post.excerpt}}` · articleSection `{{terms.category}}` · keywords `{{terms.post_tag|join:", "}}` · wordCount `{{post.word_count}}` (integer) · mainEntityOfPage via `isMainEntity`

## FAQPage (`webPageType: FAQPage`)
- **mainEntity** → `repeat` over `{{acf.faqs}}` (or the repeater the site uses) with node `Question`: **name** `{{item.question}}` (`dropNode`), **acceptedAnswer** → nested `Answer` with **text** `{{item.answer}}`. Put `onEmpty: dropNode` on `mainEntity` so a page without questions outputs no FAQPage.
- If questions are fixed for the page (a single FAQ page rather than a type), you may write literal Question nodes from the page text — then say so.

## HowTo
- **name** `{{post.title}}` · **step** → repeat over `{{acf.steps}}` with `HowToStep`: name `{{item.title}}`, **text** `{{item.text}}`, image `{{item.image}}`, url `{{post.permalink}}#step-{{item.index}}` · description `{{post.excerpt}}` · image `ref yoast:primaryimage` · totalTime `{{meta.total_time}}` (ISO 8601 duration e.g. `PT30M`) · estimatedCost → `MonetaryAmount` · tool/supply → repeat `HowToTool`/`HowToSupply`

## Recipe
- **name**, **image** · author `ref yoast:author` · datePublished `{{post.date}}` · description · prepTime/cookTime/totalTime `{{meta.prep_time}}` (ISO durations) · recipeYield `{{meta.servings}}` · recipeCategory `{{terms.category}}` · recipeCuisine · keywords · **recipeIngredient** `{{acf.ingredients}}` (a list token expands to multiple values) · **recipeInstructions** → repeat `HowToStep` with text `{{item.value}}` or `{{item.text}}` · nutrition → `NutritionInformation` (calories `{{meta.calories}}`) · aggregateRating when shown · video → `VideoObject` when embedded

## Event
- **name** · **startDate** `{{meta.start_date}}` (datetime, `dropNode`) · endDate · **location** → `Place` (name, address → `PostalAddress` or text) or `VirtualLocation` (url) · eventAttendanceMode / eventStatus literals (`https://schema.org/OfflineEventAttendanceMode`, `https://schema.org/EventScheduled`) · image · description · offers → `Offer` (price, priceCurrency, url `{{meta.ticket_url}}`, availability, validFrom) · performer → `PerformingGroup`/`Person` · organizer `ref yoast:organization`

## LocalBusiness (and subtypes: Restaurant, Store, Dentist, LegalService, HomeAndConstructionBusiness…)
- **name** `{{site.name}}` or literal · **address** → `PostalAddress` (streetAddress, addressLocality, addressRegion, postalCode, addressCountry) · telephone · url `{{site.url}}` · image / logo `{{site.logo_object}}` · priceRange (`$$`) · openingHoursSpecification → repeat `OpeningHoursSpecification` (dayOfWeek, opens, closes) or literal nodes · geo → `GeoCoordinates` · sameAs (social URLs, multiple values) · servesCuisine / menu (Restaurant) · aggregateRating when shown · areaServed
- Usually assigned to the front page / contact page rather than a post type. For a multi-location site, use the location post type with `{{meta.*}}` tokens.

## Organization (About page, or when Yoast's organization needs enrichment)
- Prefer `ref yoast:organization` elsewhere. For an About page: name, url, logo, description, foundingDate, founder → `Person`, address, contactPoint → `ContactPoint` (telephone, contactType, areaServed, availableLanguage), sameAs, numberOfEmployees → `QuantitativeValue`.

## APIReference / WebAPI (developer docs)
- Root `APIReference` (`isMainEntity`, `suppressArticle: true`): **headline** `{{post.title}}` · description `{{post.excerpt}}` · programmingModel (`REST`, `GraphQL`) literal · targetPlatform · assemblyVersion `{{meta.api_version}}` · executableLibraryName (SDK name) · proficiencyLevel (`Beginner`/`Expert`) · dependencies · author `ref yoast:organization` · datePublished/dateModified · about → `WebAPI` node (`placement: graph`): name, documentation `{{post.permalink}}` (url), termsOfService, provider `ref yoast:organization`, availableChannel/endpointUrl when known
- Add `potentialAction` → `SearchAction` with target `{{site.url}}?s={search_term_string}` and `query-input` = `required name=search_term_string` only when the docs have a search box.
- Guides/tutorials (not references): `TechArticle` with `proficiencyLevel` and `dependencies`.

## SoftwareApplication / WebApplication / MobileApplication
- **name** · **offers** → `Offer` (price `0` for free, priceCurrency) · **aggregateRating** when shown (required by Google alongside offers for the rich result) · applicationCategory (`DeveloperApplication`, `BusinessApplication`…) · operatingSystem · softwareVersion `{{meta.version}}` · downloadUrl / installUrl · screenshot `{{acf.screenshots}}` · featureList · releaseNotes · softwareRequirements · author/publisher `ref yoast:organization`

## JobPosting
- **title** `{{post.title}}` · **description** `{{post.content}}` (HTML allowed) · **datePosted** `{{post.date}}` (date) · validThrough `{{meta.closing_date}}` · **hiringOrganization** `ref yoast:organization` or `Organization` node · **jobLocation** → `Place` with `PostalAddress` (or `jobLocationType: TELECOMMUTE` + applicantLocationRequirements) · baseSalary → `MonetaryAmount` with `QuantitativeValue` (minValue/maxValue/unitText `YEAR`) · employmentType (`FULL_TIME`) · identifier → `PropertyValue` · directApply `true` (boolean)

## Course
- **name** · **description** · **provider** `ref yoast:organization` · offers → `Offer` · hasCourseInstance → `CourseInstance` (courseMode `online`, courseWorkload `PT10H`) · educationalLevel · about · instructor → `Person` · image

## VideoObject
- **name** · **description** · **thumbnailUrl** `{{meta.video_thumbnail}}` or featured image URL · **uploadDate** `{{post.date}}` · duration (`PT4M12S`) `{{meta.video_duration}}` · contentUrl / embedUrl `{{meta.video_url}}` · publisher `ref yoast:publisher`

## Person (author/profile pages, `webPageType: ProfilePage`)
- name `{{post.title}}` · description · image · jobTitle `{{meta.job_title}}` · worksFor `ref yoast:organization` · sameAs (social links, multiple values) · url `{{post.permalink}}` · knowsAbout `{{terms.expertise}}`

## Service
- name · description · provider `ref yoast:organization` · serviceType `{{terms.service_type.first.name}}` · areaServed · offers → `Offer` or `AggregateOffer` · hasOfferCatalog → `OfferCatalog` for packages · image

## BreadcrumbList / ItemList
Yoast outputs breadcrumbs — don't rebuild them. For category/collection pages: `webPageType: CollectionPage` and, if items are in a repeater or relationship field, `ItemList` → repeat `ListItem` (position `{{item.index}}` integer, url `{{item.url}}`, name `{{item.name}}`).

## Common extras worth adding when the page shows them
- `sameAs` social links on Organization/Person/LocalBusiness (multiple text values, dataType url)
- `image` as `ImageObject` via `{{post.featured_image_object}}` rather than a bare URL when Google wants width/height (Article, Recipe)
- `inLanguage` `{{site.language}}`
- `isAccessibleForFree` boolean, `hasPart` → `WebPageElement` with `isAccessibleForFree false` + `cssSelector` for paywalled content
- `speakable` → `SpeakableSpecification` with `cssSelector` values for news
