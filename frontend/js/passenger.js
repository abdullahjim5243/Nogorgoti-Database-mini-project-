let passengerUser = null;
let passengerStops = [];
let passengerFareLogs = [];
let passengerPosts = [];

document.addEventListener(
    "DOMContentLoaded",
    initPassenger
);


// =========================================================
// INITIALIZE PASSENGER PAGE
// =========================================================

async function initPassenger() {

    passengerUser =
        requireSignedInUser("PASSENGER");


    if (!passengerUser) {
        return;
    }


    document.getElementById(
        "sidebarUserName"
    ).textContent =
        passengerUser.name;


    document.getElementById(
        "sidebarUserEmail"
    ).textContent =
        passengerUser.email;


    document.getElementById(
        "sidebarAvatar"
    ).textContent =
        (
            passengerUser.name || "P"
        )
        .trim()
        .charAt(0)
        .toUpperCase();


    document.getElementById(
        "passengerGreeting"
    ).textContent =
        `Good to see you, ${passengerUser.name.split(" ")[0]}.`;


    document.getElementById(
        "overviewRole"
    ).textContent =
        passengerUser.role;


    try {

        [
            passengerStops,
            passengerFareLogs,
            passengerPosts
        ] = await Promise.all([

            apiRequest("/stops"),

            apiRequest("/fare-logs"),

            apiRequest("/forum/posts")

        ]);


        fillPassengerStopSelects();

        renderPassengerFareReports();

        await renderPassengerForum();

        await loadProfile();

        wirePassengerForms();


    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// POPULATE STOP DROPDOWNS
// =========================================================

function fillPassengerStopSelects() {

    const selectIds = [

        "overviewStudentOrigin",
        "overviewStudentDestination",

        "studentFareOrigin",
        "studentFareDestination",

        "fareReportOrigin",
        "fareReportDestination"

    ];


    selectIds.forEach(id => {

        populateSelect(
            document.getElementById(id),
            passengerStops,
            "stop_id",
            stop => stop.stop_name,
            "Select stop"
        );

    });
}


// =========================================================
// PASSENGER FORM EVENTS
// =========================================================

function wirePassengerForms() {


    // =====================================================
    // STUDENT FARE LOOKUP — OVERVIEW
    // =====================================================

    bindStudentFareForm(

        "overviewStudentFareForm",

        "overviewStudentOrigin",

        "overviewStudentDestination",

        "overviewStudentTransport",

        "overviewStudentFareResult"

    );


    // =====================================================
    // STUDENT FARE LOOKUP — STUDENT PAGE
    // =====================================================

    bindStudentFareForm(

        "studentFareForm",

        "studentFareOrigin",

        "studentFareDestination",

        "studentFareTransport",

        "studentFareResult"

    );


    // =====================================================
    // STUDENT VERIFICATION
    // =====================================================

    document
        .getElementById(
            "studentVerificationForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                try {

                    const result =
                        await apiRequest(
                            "/student-verifications",
                            {
                                method: "POST",

                                auth: true,

                                body: {

                                    student_id_number:
                                        document
                                            .getElementById(
                                                "studentIdNumber"
                                            )
                                            .value
                                            .trim(),

                                    // Database column is
                                    // institution_name
                                    institution_name:
                                        document
                                            .getElementById(
                                                "universityName"
                                            )
                                            .value
                                            .trim(),

                                    // Optional for now
                                    id_card_url: null
                                }
                            }
                        );


                    showToast(
                        `Verification request #${result.verification_id} submitted.`
                    );


                    event.target.reset();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );


    // =====================================================
    // FARE REPORT
    // =====================================================

    document
        .getElementById(
            "fareReportForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const origin =
                    document.getElementById(
                        "fareReportOrigin"
                    ).value;


                const destination =
                    document.getElementById(
                        "fareReportDestination"
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


                try {

                    const result =
                        await apiRequest(
                            "/fare-logs",
                            {
                                method: "POST",

                                auth: true,

                                body: {

                                    amount_paid:
                                        Number(
                                            document.getElementById(
                                                "fareReportAmount"
                                            ).value
                                        ),

                                    transport_type:
                                        document.getElementById(
                                            "fareReportTransport"
                                        ).value,

                                    origin_stop_id:
                                        Number(
                                            origin
                                        ),

                                    destination_stop_id:
                                        Number(
                                            destination
                                        )
                                }
                            }
                        );


                    showToast(
                        `Fare report #${result.fare_log_id} added.`
                    );


                    event.target.reset();


                    passengerFareLogs =
                        await apiRequest(
                            "/fare-logs"
                        );


                    renderPassengerFareReports();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );


    // =====================================================
    // CREATE FORUM POST
    // =====================================================

    document
        .getElementById(
            "forumPostForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                try {

                    const result =
                        await apiRequest(
                            "/forum/posts",
                            {
                                method: "POST",

                                auth: true,

                                body: {

                                    title:
                                        document
                                            .getElementById(
                                                "forumPostTitle"
                                            )
                                            .value
                                            .trim(),

                                    description:
                                        document
                                            .getElementById(
                                                "forumPostDescription"
                                            )
                                            .value
                                            .trim()
                                }
                            }
                        );


                    showToast(
                        `Post #${result.post_id} published.`
                    );


                    event.target.reset();


                    passengerPosts =
                        await apiRequest(
                            "/forum/posts"
                        );


                    await renderPassengerForum();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );


    // =====================================================
    // SUBMIT RATING
    // =====================================================

    document
        .getElementById(
            "ratingForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const body = {

                    comment:
                        document
                            .getElementById(
                                "ratingComment"
                            )
                            .value
                            .trim(),

                    rating_value:
                        Number(
                            document.getElementById(
                                "ratingValue"
                            ).value
                        ),

                    transport_id: null,

                    company_id: null,

                    route_id: null
                };


                applyTarget(

                    body,

                    document.getElementById(
                        "ratingTargetType"
                    ).value,

                    Number(
                        document.getElementById(
                            "ratingTargetId"
                        ).value
                    )

                );


                try {

                    await apiRequest(
                        "/feedback/ratings",
                        {
                            method: "POST",
                            auth: true,
                            body: body
                        }
                    );


                    showToast(
                        "Rating submitted."
                    );


                    event.target.reset();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );


    // =====================================================
    // SUBMIT COMPLAINT
    // =====================================================

    document
        .getElementById(
            "complaintForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                const body = {

                    comment:
                        document
                            .getElementById(
                                "complaintComment"
                            )
                            .value
                            .trim(),

                    complaint_category:
                        document
                            .getElementById(
                                "complaintCategory"
                            )
                            .value
                            .trim(),

                    transport_id: null,

                    company_id: null,

                    route_id: null
                };


                applyTarget(

                    body,

                    document.getElementById(
                        "complaintTargetType"
                    ).value,

                    Number(
                        document.getElementById(
                            "complaintTargetId"
                        ).value
                    )

                );


                try {

                    const result =
                        await apiRequest(
                            "/feedback/complaints",
                            {
                                method: "POST",
                                auth: true,
                                body: body
                            }
                        );


                    showToast(
                        `Complaint submitted with status ${result.status}.`
                    );


                    event.target.reset();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );


    // =====================================================
    // UPDATE PROFILE
    // =====================================================

    document
        .getElementById(
            "profileForm"
        )
        .addEventListener(
            "submit",
            async event => {

                event.preventDefault();


                try {

                    const body = {

                        name:
                            document
                                .getElementById(
                                    "profileName"
                                )
                                .value
                                .trim(),

                        email:
                            document
                                .getElementById(
                                    "profileEmail"
                                )
                                .value
                                .trim(),

                        phone:
                            document
                                .getElementById(
                                    "profilePhone"
                                )
                                .value
                                .trim()
                            || null
                    };


                    await apiRequest(
                        `/users/${passengerUser.user_id}`,
                        {
                            method: "PUT",
                            auth: true,
                            body: body
                        }
                    );


                    passengerUser = {
                        ...passengerUser,
                        ...body
                    };


                    localStorage.setItem(
                        USER_KEY,
                        JSON.stringify(
                            passengerUser
                        )
                    );


                    document.getElementById(
                        "sidebarUserName"
                    ).textContent =
                        passengerUser.name;


                    document.getElementById(
                        "sidebarUserEmail"
                    ).textContent =
                        passengerUser.email;


                    showToast(
                        "Profile updated."
                    );


                    await loadProfile();


                } catch (error) {

                    showToast(
                        error.message,
                        "error"
                    );
                }
            }
        );
}


// =========================================================
// STUDENT FARE LOOKUP
// =========================================================

function bindStudentFareForm(
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


                if (
                    origin === destination
                ) {

                    showToast(
                        "Origin and destination cannot be the same.",
                        "error"
                    );

                    return;
                }


                try {

                    const query =
                        buildQuery({

                            origin_stop_id:
                                origin,

                            destination_stop_id:
                                destination,

                            transport_type:
                                document.getElementById(
                                    transportId
                                ).value

                        });


                    const fare =
                        await apiRequest(
                            `/fare-lookup/student?${query}`,
                            {
                                auth: true
                            }
                        );


                    renderFareResult(

                        document.getElementById(
                            resultId
                        ),

                        fare,

                        true
                    );


                } catch (error) {

                    document
                        .getElementById(
                            resultId
                        )
                        .classList
                        .add(
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


// =========================================================
// PASSENGER FARE REPORTS
// =========================================================

function renderPassengerFareReports() {

    const host =
        document.getElementById(
            "passengerFareReports"
        );


    const ownReports =
        passengerFareLogs.filter(
            report =>

                Number(
                    report.user_id
                )

                ===

                Number(
                    passengerUser.user_id
                )
        );


    if (!ownReports.length) {

        host.innerHTML = `

            <div class="empty-state">

                You have not submitted
                a fare report yet.

            </div>

        `;

        return;
    }


    host.innerHTML =
        ownReports.map(
            report => `

                <div class="data-row">

                    <span>

                        <strong>

                            ${escapeHtml(
                                report.origin_stop_name
                            )}

                            →

                            ${escapeHtml(
                                report.destination_stop_name
                            )}

                        </strong>


                        <span>

                            ${escapeHtml(
                                report.transport_type
                            )}

                            ·

                            ${formatDate(
                                report.created_at
                            )}

                        </span>

                    </span>


                    <strong>

                        ${formatMoney(
                            report.amount_paid
                        )}

                    </strong>

                </div>

            `
        ).join("");
}


// =========================================================
// PASSENGER FORUM
// =========================================================

async function renderPassengerForum() {

    const host =
        document.getElementById(
            "passengerForumList"
        );


    if (!passengerPosts.length) {

        host.innerHTML = `

            <div class="empty-state">

                No forum posts yet.

            </div>

        `;

        return;
    }


    host.innerHTML =
        passengerPosts.map(
            post => `

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


                    <form class="reply-form">

                        <input
                            name="reply"
                            placeholder="Write a reply"
                            required
                        >

                        <button
                            class="btn btn-primary btn-small"
                            type="submit"
                        >
                            Reply
                        </button>

                    </form>

                </article>

            `
        ).join("");


    await Promise.all(

        passengerPosts.map(
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

                    } else {

                        repliesHost.innerHTML =
                            replies.map(
                                reply => `

                                    <div class="reply-box">

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
                    }


                } catch (error) {

                    repliesHost.innerHTML = `

                        <div class="empty-state">

                            ${escapeHtml(
                                error.message
                            )}

                        </div>

                    `;
                }


                card
                    .querySelector(
                        ".reply-form"
                    )
                    .addEventListener(
                        "submit",
                        async event => {

                            event.preventDefault();


                            const input =
                                event.target
                                    .elements
                                    .reply;


                            try {

                                await apiRequest(

                                    `/forum/posts/${post.post_id}/replies`,

                                    {
                                        method: "POST",

                                        auth: true,

                                        body: {

                                            reply_text:
                                                input.value.trim()

                                        }
                                    }

                                );


                                input.value = "";


                                const replies =
                                    await apiRequest(
                                        `/forum/posts/${post.post_id}/replies`
                                    );


                                repliesHost.innerHTML =
                                    replies.map(
                                        reply => `

                                            <div class="reply-box">

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


                                showToast(
                                    "Reply added."
                                );


                            } catch (error) {

                                showToast(
                                    error.message,
                                    "error"
                                );
                            }
                        }
                    );
            }
        )
    );
}


// =========================================================
// LOAD PASSENGER PROFILE
// =========================================================

async function loadProfile() {

    try {

        const profile =
            await apiRequest(
                `/users/${passengerUser.user_id}`,
                {
                    auth: true
                }
            );


        document.getElementById(
            "profileName"
        ).value =
            profile.name || "";


        document.getElementById(
            "profileEmail"
        ).value =
            profile.email || "";


        document.getElementById(
            "profilePhone"
        ).value =
            profile.phone || "";


        document.getElementById(
            "profileSummary"
        ).innerHTML = `

            <span class="section-kicker">
                ACCOUNT SUMMARY
            </span>


            <h3>

                ${escapeHtml(
                    profile.name
                )}

            </h3>


            <div class="profile-line">

                <span>
                    User ID
                </span>

                <strong>
                    ${profile.user_id}
                </strong>

            </div>


            <div class="profile-line">

                <span>
                    Email
                </span>

                <strong>
                    ${escapeHtml(
                        profile.email
                    )}
                </strong>

            </div>


            <div class="profile-line">

                <span>
                    Phone
                </span>

                <strong>

                    ${escapeHtml(
                        profile.phone ||
                        "Not provided"
                    )}

                </strong>

            </div>


            <div class="profile-line">

                <span>
                    Role
                </span>

                <strong>

                    ${escapeHtml(
                        profile.role
                    )}

                </strong>

            </div>


            <div class="profile-line">

                <span>
                    Created
                </span>

                <strong>

                    ${formatDate(
                        profile.created_at
                    )}

                </strong>

            </div>

        `;


    } catch (error) {

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// ASSIGN FEEDBACK TARGET
// =========================================================

function applyTarget(
    body,
    type,
    id
) {

    if (
        type === "transport"
    ) {

        body.transport_id = id;
    }


    if (
        type === "company"
    ) {

        body.company_id = id;
    }


    if (
        type === "route"
    ) {

        body.route_id = id;
    }
}