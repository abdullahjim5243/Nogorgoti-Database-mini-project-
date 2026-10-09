let guestStops = [];
let guestRoutes = [];
let guestFares = [];
let guestFareLogs = [];
let guestPosts = [];
let guestRatings = [];

document.addEventListener("DOMContentLoaded", initGuest);


// =========================================================
// LOAD EACH GUEST SECTION INDEPENDENTLY
// =========================================================

async function loadGuestSection(path, label) {

    try {

        return await apiRequest(path);

    } catch (error) {

        console.error(
            `Failed to load ${label}:`,
            error
        );

        showToast(
            `Could not load ${label}: ${error.message}`,
            "error"
        );

        return [];
    }
}


// =========================================================
// INITIALIZE GUEST PAGE
// =========================================================

async function initGuest() {

    const [
        stops,
        routes,
        fares,
        fareLogs,
        posts,
        ratings
    ] = await Promise.all([

        loadGuestSection(
            "/stops",
            "stops"
        ),

        loadGuestSection(
            "/routes",
            "routes"
        ),

        loadGuestSection(
            "/fares",
            "fares"
        ),

        loadGuestSection(
            "/fare-logs",
            "fare reports"
        ),

        loadGuestSection(
            "/forum/posts",
            "forum posts"
        ),

        loadGuestSection(
            "/feedback/ratings",
            "ratings"
        )

    ]);


    guestStops = stops;
    guestRoutes = routes;
    guestFares = fares;
    guestFareLogs = fareLogs;
    guestPosts = posts;
    guestRatings = ratings;


    fillGuestSelects();

    renderGuestMetrics();

    renderStops(
        guestStops
    );

    renderRoutes();

    renderAllFares();

    renderFareLogs();

    await renderForum();

    renderRatings();

    wireGuestForms();
}


// =========================================================
// POPULATE DROPDOWNS
// =========================================================

function fillGuestSelects() {

    const stopSelectIds = [

        "guestQuickOrigin",
        "guestQuickDestination",

        "guestFareOrigin",
        "guestFareDestination",

        "statsOrigin",
        "statsDestination"

    ];


    stopSelectIds.forEach(id => {

        populateSelect(
            document.getElementById(id),
            guestStops,
            "stop_id",
            stop => stop.stop_name,
            "Select stop"
        );

    });


    populateSelect(
        document.getElementById(
            "guestRouteSelect"
        ),

        guestRoutes,

        "route_id",

        route =>
            `${route.route_name}${
                route.route_number
                    ? ` (${route.route_number})`
                    : ""
            }`,

        "Select route"
    );
}


// =========================================================
// GUEST OVERVIEW METRICS
// =========================================================

function renderGuestMetrics() {

    const host =
        document.getElementById(
            "guestMetrics"
        );


    host.innerHTML = `

        <article class="metric-card">

            <span>Routes</span>

            <strong>
                ${guestRoutes.length}
            </strong>

            <small>
                Available route records
            </small>

        </article>


        <article class="metric-card">

            <span>Stops</span>

            <strong>
                ${guestStops.length}
            </strong>

            <small>
                Known transport points
            </small>

        </article>


        <article class="metric-card">

            <span>Official fares</span>

            <strong>
                ${guestFares.length}
            </strong>

            <small>
                Listed fare records
            </small>

        </article>


        <article class="metric-card">

            <span>Fare reports</span>

            <strong>
                ${guestFareLogs.length}
            </strong>

            <small>
                Community submissions
            </small>

        </article>

    `;
}


// =========================================================
// STOPS
// =========================================================

function renderStops(stops) {

    const host =
        document.getElementById(
            "guestStopsGrid"
        );


    if (!stops.length) {

        host.innerHTML = `
            <div class="empty-state">
                No stops found.
            </div>
        `;

        return;
    }


    host.innerHTML =
        stops.map(stop => `

            <article class="info-card">

                <span class="section-kicker">
                    STOP #${escapeHtml(
                        stop.stop_id
                    )}
                </span>

                <h3>
                    ${escapeHtml(
                        stop.stop_name
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        stop.location ||
                        "Location not specified"
                    )}
                </p>

                <div class="meta">

                    ${
                        stop.latitude ?? "—"
                    },

                    ${
                        stop.longitude ?? "—"
                    }

                </div>

            </article>

        `).join("");
}


// =========================================================
// ROUTES
// =========================================================

function renderRoutes() {

    const host =
        document.getElementById(
            "routeList"
        );


    if (!guestRoutes.length) {

        host.innerHTML = `
            <div class="empty-state">
                No routes found.
            </div>
        `;

        return;
    }


    host.innerHTML =
        guestRoutes.map(route => `

            <button
                class="data-row route-choice"
                data-route-id="${route.route_id}"
            >

                <span>

                    <strong>
                        ${escapeHtml(
                            route.route_name
                        )}
                    </strong>

                    <span>
                        ${escapeHtml(
                            route.route_number ||
                            "No route number"
                        )}
                    </span>

                </span>

                <span>
                    →
                </span>

            </button>

        `).join("");


    host
        .querySelectorAll(
            ".route-choice"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const routeId =
                        button.dataset.routeId;


                    document.getElementById(
                        "guestRouteSelect"
                    ).value = routeId;


                    loadRouteStops(
                        routeId
                    );
                }
            );

        });


    document
        .getElementById(
            "guestRouteSelect"
        )
        .addEventListener(
            "change",
            event => {

                loadRouteStops(
                    event.target.value
                );

            }
        );
}


// =========================================================
// ROUTE STOPS
// =========================================================

async function loadRouteStops(routeId) {

    const host =
        document.getElementById(
            "routeStopsTimeline"
        );


    const title =
        document.getElementById(
            "selectedRouteTitle"
        );


    if (!routeId) {

        host.textContent =
            "Choose a route to see its stops.";


        title.textContent =
            "Select a route";


        return;
    }


    const route =
        guestRoutes.find(
            route =>
                String(
                    route.route_id
                ) ===
                String(
                    routeId
                )
        );


    title.textContent =
        route
            ? route.route_name
            : "Route";


    host.innerHTML = `
        <div class="empty-state">
            Loading route...
        </div>
    `;


    try {

        const stops =
            await apiRequest(
                `/routes/${routeId}/stops`
            );


        if (!stops.length) {

            host.innerHTML = `
                <div class="empty-state">
                    No stops assigned
                    to this route.
                </div>
            `;

            return;
        }


        host.innerHTML =
            stops.map(stop => `

                <div class="timeline-item">

                    <span
                        class="timeline-index"
                    >
                        ${escapeHtml(
                            stop.stop_sequence
                        )}
                    </span>


                    <span>

                        <strong>
                            ${escapeHtml(
                                stop.stop_name
                            )}
                        </strong>

                        <span>
                            ${escapeHtml(
                                stop.location || ""
                            )}
                        </span>

                    </span>


                    <span>

                        ${
                            stop.distance_from_previous
                            ?? "—"
                        } km

                    </span>

                </div>

            `).join("");


    } catch (error) {

        host.innerHTML = `
            <div class="empty-state">
                ${escapeHtml(
                    error.message
                )}
            </div>
        `;
    }
}


// =========================================================
// OFFICIAL FARES TABLE
// =========================================================

function renderAllFares() {

    const host =
        document.getElementById(
            "allFaresTable"
        );


    host.innerHTML = `

        <table class="data-table">

            <thead>

                <tr>

                    <th>ID</th>
                    <th>Transport</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Standard</th>
                    <th>Student</th>

                </tr>

            </thead>


            <tbody>

                ${
                    guestFares
                    .map(fare => `

                        <tr>

                            <td>
                                ${fare.fare_id}
                            </td>

                            <td>
                                ${escapeHtml(
                                    fare.transport_type
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    fare.origin_stop_name
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    fare.destination_stop_name
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    fare.standard_fare
                                )}
                            </td>

                            <td>
                                ${formatMoney(
                                    fare.student_fare
                                )}
                            </td>

                        </tr>

                    `)
                    .join("")
                }

            </tbody>

        </table>

    `;
}


// =========================================================
// FARE REPORTS
// =========================================================

function renderFareLogs() {

    const host =
        document.getElementById(
            "fareReportsList"
        );


    if (!guestFareLogs.length) {

        host.innerHTML = `
            <div class="empty-state">
                No community fare reports yet.
            </div>
        `;

        return;
    }


    host.innerHTML =
        guestFareLogs.map(log => `

            <div class="data-row">

                <span>

                    <strong>

                        ${escapeHtml(
                            log.origin_stop_name
                        )}

                        →

                        ${escapeHtml(
                            log.destination_stop_name
                        )}

                    </strong>


                    <span>

                        ${escapeHtml(
                            log.user_name ||
                            "Passenger"
                        )}

                        ·

                        ${escapeHtml(
                            log.transport_type
                        )}

                        ·

                        ${formatDate(
                            log.created_at
                        )}

                    </span>

                </span>


                <strong>
                    ${formatMoney(
                        log.amount_paid
                    )}
                </strong>

            </div>

        `).join("");
}


// =========================================================
// FORUM
// =========================================================

async function renderForum() {

    const host =
        document.getElementById(
            "guestForumList"
        );


    if (!guestPosts.length) {

        host.innerHTML = `
            <div class="empty-state">
                No forum posts yet.
            </div>
        `;

        return;
    }


    host.innerHTML =
        guestPosts.map(post => `

            <article
                class="forum-card"
                data-post-id="${post.post_id}"
            >

                <h3>
                    ${escapeHtml(
                        post.title
                    )}
                </h3>

                <p>
                    ${escapeHtml(
                        post.description
                    )}
                </p>

                <div class="forum-meta">

                    <span>
                        By
                        ${escapeHtml(
                            post.user_name
                        )}
                    </span>

                    <span>
                        ${formatDate(
                            post.created_at
                        )}
                    </span>

                </div>


                <div class="replies">

                    <div class="empty-state">
                        Loading replies...
                    </div>

                </div>

            </article>

        `).join("");


    await Promise.all(

        guestPosts.map(
            async post => {

                const card =
                    host.querySelector(
                        `[data-post-id="${post.post_id}"]`
                    );


                const repliesHost =
                    card.querySelector(
                        ".replies"
                    );


                try {

                    const replies =
                        await apiRequest(
                            `/forum/posts/${post.post_id}/replies`
                        );


                    if (!replies.length) {

                        repliesHost.innerHTML = `
                            <div class="empty-state">
                                No replies yet.
                            </div>
                        `;

                        return;
                    }


                    repliesHost.innerHTML =
                        replies.map(
                            reply => `

                                <div
                                    class="reply-box"
                                >

                                    <p>
                                        ${escapeHtml(
                                            reply.reply_text
                                        )}
                                    </p>

                                    <span>

                                        ${escapeHtml(
                                            reply.user_name
                                        )}

                                        ·

                                        ${formatDate(
                                            reply.created_at
                                        )}

                                    </span>

                                </div>

                            `
                        ).join("");


                } catch (error) {

                    repliesHost.innerHTML = `
                        <div class="empty-state">
                            ${escapeHtml(
                                error.message
                            )}
                        </div>
                    `;
                }
            }
        )
    );
}


// =========================================================
// RATINGS
// =========================================================

function renderRatings() {

    const host =
        document.getElementById(
            "guestRatingsList"
        );


    if (!guestRatings.length) {

        host.innerHTML = `
            <div class="empty-state">
                No ratings available.
            </div>
        `;

        return;
    }


    host.innerHTML =
        guestRatings.map(
            rating => `

                <article class="info-card">

                    <span class="section-kicker">

                        ${"★".repeat(
                            Math.max(
                                1,
                                Math.min(
                                    5,
                                    Number(
                                        rating.rating_value
                                    )
                                )
                            )
                        )}

                    </span>


                    <h3>
                        ${escapeHtml(
                            rating.user_name
                        )}
                    </h3>


                    <p>
                        ${escapeHtml(
                            rating.comment
                        )}
                    </p>


                    <div class="meta">

                        Transport:
                        ${
                            rating.transport_id
                            ?? "—"
                        }

                        · Company:
                        ${
                            rating.company_id
                            ?? "—"
                        }

                        · Route:
                        ${
                            rating.route_id
                            ?? "—"
                        }

                    </div>

                </article>

            `
        ).join("");
}


// =========================================================
// GUEST FORMS
// =========================================================

function wireGuestForms() {

    const stopSearch =
        document.getElementById(
            "stopSearch"
        );


    stopSearch.addEventListener(
        "input",
        event => {

            const query =
                event.target.value
                    .trim()
                    .toLowerCase();


            const filteredStops =
                guestStops.filter(
                    stop =>

                        (
                            stop.stop_name ||
                            ""
                        )
                        .toLowerCase()
                        .includes(query)

                        ||

                        (
                            stop.location ||
                            ""
                        )
                        .toLowerCase()
                        .includes(query)

                );


            renderStops(
                filteredStops
            );

        }
    );


    bindFareForm(
        "guestQuickFareForm",
        "guestQuickOrigin",
        "guestQuickDestination",
        "guestQuickTransport",
        "guestQuickFareResult"
    );


    bindFareForm(
        "guestFareForm",
        "guestFareOrigin",
        "guestFareDestination",
        "guestFareTransport",
        "guestFareResult"
    );


    document
        .getElementById(
            "fareStatsForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const query =
                    buildQuery({

                        origin_stop_id:
                            document.getElementById(
                                "statsOrigin"
                            ).value,

                        destination_stop_id:
                            document.getElementById(
                                "statsDestination"
                            ).value,

                        transport_type:
                            document.getElementById(
                                "statsTransport"
                            ).value

                    });


                try {

                    const stats =
                        await apiRequest(
                            `/fare-logs/stats?${query}`
                        );


                    document.getElementById(
                        "fareStatsResult"
                    ).innerHTML = `

                        <article
                            class="metric-card"
                        >

                            <span>
                                Reports
                            </span>

                            <strong>
                                ${stats.report_count}
                            </strong>

                            <small>
                                Matching submissions
                            </small>

                        </article>


                        <article
                            class="metric-card"
                        >

                            <span>
                                Minimum
                            </span>

                            <strong>
                                ${formatMoney(
                                    stats.minimum_fare
                                )}
                            </strong>

                            <small>
                                Lowest reported
                            </small>

                        </article>


                        <article
                            class="metric-card"
                        >

                            <span>
                                Average
                            </span>

                            <strong>
                                ${formatMoney(
                                    stats.average_fare
                                )}
                            </strong>

                            <small>
                                Mean paid
                            </small>

                        </article>


                        <article
                            class="metric-card"
                        >

                            <span>
                                Maximum
                            </span>

                            <strong>
                                ${formatMoney(
                                    stats.maximum_fare
                                )}
                            </strong>

                            <small>
                                Highest reported
                            </small>

                        </article>

                    `;


                } catch (error) {

                    document.getElementById(
                        "fareStatsResult"
                    ).innerHTML = "";


                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );
}


// =========================================================
// REUSABLE FARE FORM
// =========================================================

function bindFareForm(
    formId,
    originId,
    destinationId,
    transportId,
    resultId
) {

    document
        .getElementById(
            formId
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const origin =
                    document.getElementById(
                        originId
                    ).value;


                const destination =
                    document.getElementById(
                        destinationId
                    ).value;


                const transport =
                    document.getElementById(
                        transportId
                    ).value;


                if (
                    origin === destination
                ) {

                    showToast(
                        "Origin and destination cannot be the same.",
                        "error"
                    );

                    return;
                }


                const query =
                    buildQuery({

                        origin_stop_id:
                            origin,

                        destination_stop_id:
                            destination,

                        transport_type:
                            transport

                    });


                try {

                    const fare =
                        await apiRequest(
                            `/fare-lookup?${query}`
                        );


                    renderFareResult(
                        document.getElementById(
                            resultId
                        ),
                        fare
                    );


                } catch (error) {

                    document.getElementById(
                        resultId
                    ).classList.add(
                        "hidden"
                    );


                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );
}