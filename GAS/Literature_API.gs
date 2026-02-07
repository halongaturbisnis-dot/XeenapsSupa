
/**
 * XEENAPS PKM - GLOBAL LITERATURE SEARCH PROXY (OPENALEX & OPEN LIBRARY EDITION)
 * Memproses pencarian ke OpenAlex dan Open Library (bypass CORS) serta terjemahan via Lingva.
 */

function handleGlobalArticleSearch(params) {
  const query = params.query || "";
  const yearStart = params.yearStart;
  const yearEnd = params.yearEnd;

  // 1. TERJEMAHAN OTOMATIS VIA LINGVA (Target: EN)
  let searchTerms = query;
  try {
    const translated = lingvaTranslateQuery(query);
    if (translated) {
      searchTerms = translated;
    }
  } catch (e) {
    console.log("Lingva Engine Error: " + e.toString());
  }

  // 2. PENYUSUNAN PARAMETER OPENALEX
  let limit = params.limit || 12;
  let openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(searchTerms)}&per_page=${limit}`;
  
  if (yearStart && yearEnd) {
    openAlexUrl += `&filter=publication_year:${yearStart}-${yearEnd}`;
  } else if (yearStart) {
    openAlexUrl += `&filter=publication_year:${yearStart}-2026`;
  }

  try {
    const response = UrlFetchApp.fetch(openAlexUrl, { 
      muteHttpExceptions: true,
      headers: { "Accept": "application/json" }
    });
    
    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      return { 
        status: 'error', 
        message: 'OpenAlex API Error (' + responseCode + '): ' + response.getContentText() 
      };
    }

    const result = JSON.parse(response.getContentText());
    
    const mappedData = (result.results || []).map(item => ({
      paperId: item.id,
      title: item.display_name || "Untitled",
      authors: (item.authorships || []).map(a => ({ name: a.author.display_name })),
      year: item.publication_year || null,
      doi: item.doi ? item.doi.replace('https://doi.org/', '') : "",
      url: item.doi || item.ids?.openalex || "",
      venue: item.primary_location?.source?.display_name || "Academic Source",
      citationCount: item.cited_by_count || 0,
      abstract: "" 
    }));

    return { 
      status: 'success', 
      data: mappedData,
      translatedQuery: searchTerms !== query ? searchTerms : null
    };
  } catch (err) {
    return { status: 'error', message: 'Literature Search Proxy Error: ' + err.toString() };
  }
}

/**
 * NEW: handleGlobalBookSearch - Multi-Source Aggregator
 * Sources: Open Library, Google Books, Gutendex (Project Gutenberg)
 */
function handleGlobalBookSearch(params) {
  const query = params.query || "";
  const yearStart = params.yearStart;
  const yearEnd = params.yearEnd;
  let limit = params.limit || 12;

  // Clean ISBN input if applicable
  const cleanQuery = query.replace(/[-\s]/g, "");
  const isISBN = /^(97(8|9))?\d{9}(\d|X)$/i.test(cleanQuery);

  let requests = [];

  // --- SOURCE 1: OPEN LIBRARY ---
  let olUrl = "";
  if (isISBN) {
    olUrl = `https://openlibrary.org/search.json?isbn=${cleanQuery}&limit=${limit}`;
  } else {
    // FIX V2: Disable translation for Book Search entirely.
    // Searching for names like "Mora Claramita" causes translation engines to output garbage (e.g. "Delay Claramita")
    // which breaks the search. Raw query is safest for books (Authors/Titles).
    const searchTerms = query.trim();
    
    olUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(searchTerms)}&limit=${limit}`;
    if (yearStart && yearEnd) {
      olUrl += `&first_publish_year:[${yearStart}+TO+${yearEnd}]`;
    }
  }
  requests.push({ url: olUrl, muteHttpExceptions: true, type: 'OL' });

  // --- SOURCE 2: GOOGLE BOOKS ---
  // Note: Google Books public API doesn't require key for basic search but has lower rate limits.
  let gbUrl = `https://www.googleapis.com/books/v1/volumes?q=${isISBN ? 'isbn:' + cleanQuery : encodeURIComponent(query)}&maxResults=${limit}&printType=books`;
  requests.push({ url: gbUrl, muteHttpExceptions: true, type: 'GB' });

  // --- SOURCE 3: GUTENDEX (PROJECT GUTENBERG) ---
  // Note: Gutendex is great for classics, no strict year filter via API param easily.
  if (!isISBN) { // Gutendex is primarily text search
    let gutUrl = `https://gutendex.com/books?search=${encodeURIComponent(query)}`;
    requests.push({ url: gutUrl, muteHttpExceptions: true, type: 'GD' });
  }

  try {
    // PARALLEL FETCHING
    const responses = UrlFetchApp.fetchAll(requests);
    let combinedResults = [];

    // PROCESS: OPEN LIBRARY
    if (responses[0].getResponseCode() === 200) {
      try {
        const olData = JSON.parse(responses[0].getContentText());
        const olMapped = (olData.docs || []).map(item => ({
          paperId: item.key,
          title: item.title || "Untitled Book",
          authors: (item.author_name || []).map(name => ({ name })),
          year: item.first_publish_year || null,
          isbn: (item.isbn || [])[0] || "",
          url: `https://openlibrary.org${item.key}`,
          venue: (item.publisher || [])[0] || "Open Library",
          citationCount: 0,
          abstract: ""
        }));
        combinedResults = combinedResults.concat(olMapped);
      } catch (e) {}
    }

    // PROCESS: GOOGLE BOOKS
    if (responses[1].getResponseCode() === 200) {
      try {
        const gbData = JSON.parse(responses[1].getContentText());
        const gbMapped = (gbData.items || []).map(item => mapGoogleBooksData(item));
        
        // Manual Year Filter for Google Books
        const gbFiltered = gbMapped.filter(b => {
          if (!yearStart && !yearEnd) return true;
          const y = parseInt(b.year);
          if (!y) return true;
          return (!yearStart || y >= parseInt(yearStart)) && (!yearEnd || y <= parseInt(yearEnd));
        });
        
        combinedResults = combinedResults.concat(gbFiltered);
      } catch (e) {}
    }

    // PROCESS: GUTENDEX (Only if requested)
    if (!isISBN && responses[2] && responses[2].getResponseCode() === 200) {
      try {
        const gdData = JSON.parse(responses[2].getContentText());
        // Gutendex results usually don't have year metadata suitable for filter, usually old classics.
        const gdMapped = (gdData.results || []).slice(0, limit).map(item => mapGutendexData(item));
        combinedResults = combinedResults.concat(gdMapped);
      } catch (e) {}
    }

    // DEDUPLICATION (Simple check by Title similarity to avoid identical duplicates)
    const uniqueResults = [];
    const titlesSeen = new Set();
    
    for (const item of combinedResults) {
      const normTitle = item.title.toLowerCase().trim().substring(0, 30); // Check first 30 chars
      if (!titlesSeen.has(normTitle)) {
        uniqueResults.push(item);
        titlesSeen.add(normTitle);
      }
    }

    return { status: 'success', data: uniqueResults };

  } catch (err) {
    return { status: 'error', message: 'Multi-Source Search Error: ' + err.toString() };
  }
}

// --- HELPER MAPPERS ---

function mapGoogleBooksData(item) {
  const info = item.volumeInfo || {};
  let isbn = "";
  if (info.industryIdentifiers) {
    const isbnObj = info.industryIdentifiers.find(id => id.type === "ISBN_13") || info.industryIdentifiers[0];
    if (isbnObj) isbn = isbnObj.identifier;
  }
  
  return {
    paperId: item.id,
    title: info.title || "Untitled Volume",
    authors: (info.authors || []).map(name => ({ name })),
    year: info.publishedDate ? info.publishedDate.substring(0, 4) : null,
    isbn: isbn,
    url: info.previewLink || info.infoLink || "",
    venue: "Google Books",
    citationCount: 0,
    abstract: info.description ? info.description.substring(0, 200) + "..." : ""
  };
}

function mapGutendexData(item) {
  let url = "";
  if (item.formats && item.formats['text/html']) url = item.formats['text/html'];
  else if (item.formats && item.formats['application/epub+zip']) url = item.formats['application/epub+zip'];
  
  return {
    paperId: `gutendex_${item.id}`,
    title: item.title || "Classic Literature",
    authors: (item.authors || []).map(a => ({ name: a.name.replace(/,/, '') })), // Gutendex names are "Last, First"
    year: null, // Often purely public domain/classic
    isbn: "",
    url: url || `https://www.gutenberg.org/ebooks/${item.id}`,
    venue: "Project Gutenberg",
    citationCount: item.download_count || 0,
    abstract: "Public Domain Classic Literature"
  };
}

/**
 * Lingva Engine - Khusus untuk pencarian Query
 */
function lingvaTranslateQuery(text) {
  if (!text) return "";
  
  const instances = [
    "https://lingva.ml/api/v1/auto/en/",
    "https://lingva.garudalinux.org/api/v1/auto/en/",
    "https://lingva.lunar.icu/api/v1/auto/en/"
  ];

  for (let baseUrl of instances) {
    try {
      const url = baseUrl + encodeURIComponent(text);
      const res = UrlFetchApp.fetch(url, { 
        muteHttpExceptions: true, 
        timeoutInSeconds: 10 
      });
      
      if (res.getResponseCode() === 200) {
        const json = JSON.parse(res.getContentText());
        return json.translation || text;
      }
    } catch (e) {
      console.log("Instance failure: " + baseUrl);
    }
  }
  return text; 
}
