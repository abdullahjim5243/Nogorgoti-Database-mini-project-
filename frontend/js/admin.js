console.log("NEW ADMIN.JS IS LOADED");

let adminUser = null;

let adminTransports = [];
let adminStops = [];
let adminRoutes = [];
let adminFares = [];
let adminUsers = [];
let adminStudents = [];
let adminComplaints = [];

document.addEventListener("DOMContentLoaded", initAdmin);


// =========================================================
// INITIALIZE ADMIN
// =========================================================

async function initAdmin() {

    adminUser = requireSignedInUser("ADMIN");

    if (!adminUser) {
        return;
    }

    document.getElementById("adminSidebarName").textContent =
        adminUser.name;

    document.getElementById("adminSidebarEmail").textContent =
        adminUser.email;

    try {

        await refreshAdminData();

        wireAdminForms();

    } catch (error) {

        console.error(error);

        showToast(
            error.message,
            "error"
        );
    }
}


// =========================================================
// SAFE ADMIN REQUEST
// =========================================================

async function safeAdminRequest(
    path,
    options = {},
    label = path
) {

    try {

        const data = await apiRequest(
            path,
            options
        );

        console.log(
            `${label} loaded:`,
            data
        );

        return data;

    } catch (error) {

        console.error(
            `${label} failed:`,
            error
        );

        showToast(
            `${label} failed: ${error.message}`,
            "error"
        );

        return [];
    }
}


// =========================================================
// REFRESH ADMIN DATA
// =========================================================

async function refreshAdminData() {

    const results = await Promise.all([

        safeAdminRequest(
            "/transports",
            {},
            "Transports"
        ),

        safeAdminRequest(
            "/stops",
            {},
            "Stops"
        ),

        safeAdminRequest(
            "/routes",
            {},
            "Routes"
        ),

        safeAdminRequest(
            "/fares",
            {},
            "Fares"
        ),

        safeAdminRequest(
            "/users",
            {
                auth: true
            },
            "Users"
        ),

        safeAdminRequest(
            "/student-verifications",
            {
                auth: true
            },
            "Student verifications"
        ),

        safeAdminRequest(
            "/feedback/complaints",
            {
                auth: true
            },
            "Complaints"
        )

    ]);


    [
        adminTransports,
        adminStops,
        adminRoutes,
        adminFares,
        adminUsers,
        adminStudents,
        adminComplaints
    ] = results;


    console.log(
        "Loaded student records:",
        adminStudents
    );


    renderAdminMetrics();

    renderOverviewLists();

    renderTransportTable();

    renderStopsTable();

    renderRoutesTable();

    renderFaresTable();

    renderStudents();

    renderComplaints();

    renderUsers();

    fillAdminSelects();

    await renderAdminRouteStops();
}


// =========================================================
// ADMIN METRICS
// =========================================================

function renderAdminMetrics() {

    const pendingStudents =
        adminStudents.filter(
            student =>
                student.verification_status === "PENDING"
        ).length;


    const openComplaints =
        adminComplaints.filter(
            complaint =>
                complaint.status !== "VERIFIED"
        ).length;


    document.getElementById(
        "adminMetrics"
    ).innerHTML = `

        <article class="metric-card">
            <span>Users</span>
            <strong>${adminUsers.length}</strong>
            <small>Registered accounts</small>
        </article>

        <article class="metric-card">
            <span>Routes</span>
            <strong>${adminRoutes.length}</strong>
            <small>Route records</small>
        </article>

        <article class="metric-card">
            <span>Student requests</span>
            <strong>${pendingStudents}</strong>
            <small>Waiting for approval</small>
        </article>

        <article class="metric-card">
            <span>Open complaints</span>
            <strong>${openComplaints}</strong>
            <small>Not yet verified</small>
        </article>

    `;
}


// =========================================================
// OVERVIEW LISTS
// =========================================================

function renderOverviewLists() {

    document.getElementById(
        "overviewStudents"
    ).innerHTML =

        adminStudents
            .slice(0, 4)
            .map(
                student => `

                    <div class="data-row">

                        <span>

                            <strong>
                                ${escapeHtml(
                                    student.user_name || "Unknown user"
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    student.institution_name || ""
                                )}
                            </span>

                        </span>

                        <span
                            class="badge ${
                                getVerificationBadgeClass(
                                    student.verification_status
                                )
                            }"
                        >
                            ${escapeHtml(
                                student.verification_status
                            )}
                        </span>

                    </div>

                `
            )
            .join("")

        ||

        `
            <div class="empty-state">
                No verification records.
            </div>
        `;


    document.getElementById(
        "overviewComplaints"
    ).innerHTML =

        adminComplaints
            .slice(0, 4)
            .map(
                complaint => `

                    <div class="data-row">

                        <span>

                            <strong>
                                ${escapeHtml(
                                    complaint.complaint_category
                                )}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    complaint.user_name || "Unknown user"
                                )}
                            </span>

                        </span>

                        <span
                            class="badge ${
                                String(
                                    complaint.status
                                ).toLowerCase()
                            }"
                        >
                            ${escapeHtml(
                                complaint.status
                            )}
                        </span>

                    </div>

                `
            )
            .join("")

        ||

        `
            <div class="empty-state">
                No complaints.
            </div>
        `;
}


// =========================================================
// STUDENT STATUS BADGE
// =========================================================

function getVerificationBadgeClass(status) {

    if (status === "VERIFIED") {
        return "verified";
    }

    if (status === "PENDING") {
        return "submitted";
    }

    if (status === "REJECTED") {
        return "rejected";
    }

    return "";
}


// =========================================================
// ADMIN SELECTS
// =========================================================

function fillAdminSelects() {

    [
        "routeStopRoute",
        "routeStopInspectRoute"
    ].forEach(
        id => {

            populateSelect(
                document.getElementById(id),
                adminRoutes,
                "route_id",
                route => route.route_name,
                "Select route"
            );

        }
    );


    populateSelect(
        document.getElementById(
            "routeStopStop"
        ),
        adminStops,
        "stop_id",
        stop => stop.stop_name,
        "Select stop"
    );


    [
        "fareOrigin",
        "fareDestination"
    ].forEach(
        id => {

            populateSelect(
                document.getElementById(id),
                adminStops,
                "stop_id",
                stop => stop.stop_name,
                "Select stop"
            );

        }
    );
}


// =========================================================
// REUSABLE TABLE
// =========================================================

function tableHtml(
    headers,
    rows
) {

    return `

        <table class="data-table">

            <thead>

                <tr>

                    ${
                        headers
                            .map(
                                header =>
                                    `<th>${escapeHtml(header)}</th>`
                            )
                            .join("")
                    }

                </tr>

            </thead>

            <tbody>

                ${
                    rows.length

                    ?

                    rows
                        .map(
                            row => `

                                <tr>

                                    ${
                                        row
                                            .map(
                                                cell =>
                                                    `<td>${cell}</td>`
                                            )
                                            .join("")
                                    }

                                </tr>

                            `
                        )
                        .join("")

                    :

                    `

                        <tr>

                            <td
                                colspan="${headers.length}"
                                class="empty-state"
                            >
                                No records found.
                            </td>

                        </tr>

                    `
                }

            </tbody>

        </table>

    `;
}


// =========================================================
// TRANSPORT TABLE
// =========================================================

function renderTransportTable() {

    const host =
        document.getElementById(
            "adminTransportTable"
        );


    host.innerHTML =
        tableHtml(

            [
                "ID",
                "Type",
                "Number",
                "Capacity",
                "Company",
                "Actions"
            ],

            adminTransports.map(
                transport => [

                    transport.transport_id,

                    escapeHtml(
                        transport.transport_type
                    ),

                    escapeHtml(
                        transport.transport_number
                    ),

                    transport.capacity ?? "—",

                    transport.company_id ?? "—",

                    `

                        <div class="data-row-actions">

                            <button
                                class="btn btn-ghost btn-small"
                                data-edit-transport="${transport.transport_id}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn btn-danger btn-small"
                                data-delete-transport="${transport.transport_id}"
                            >
                                Delete
                            </button>

                        </div>

                    `

                ]
            )
        );


    host
        .querySelectorAll(
            "[data-edit-transport]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        startTransportEdit(
                            Number(
                                button.dataset.editTransport
                            )
                        );

                    }
                );

            }
        );


    host
        .querySelectorAll(
            "[data-delete-transport]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteTransport(
                            Number(
                                button.dataset.deleteTransport
                            )
                        );

                    }
                );

            }
        );
}


// =========================================================
// STOPS TABLE
// =========================================================

function renderStopsTable() {

    const host =
        document.getElementById(
            "adminStopsTable"
        );


    host.innerHTML =
        tableHtml(

            [
                "ID",
                "Name",
                "Location",
                "Latitude",
                "Longitude",
                "Actions"
            ],

            adminStops.map(
                stop => [

                    stop.stop_id,

                    escapeHtml(
                        stop.stop_name
                    ),

                    escapeHtml(
                        stop.location || "—"
                    ),

                    stop.latitude ?? "—",

                    stop.longitude ?? "—",

                    `

                        <div class="data-row-actions">

                            <button
                                class="btn btn-ghost btn-small"
                                data-edit-stop="${stop.stop_id}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn btn-danger btn-small"
                                data-delete-stop="${stop.stop_id}"
                            >
                                Delete
                            </button>

                        </div>

                    `

                ]
            )
        );


    host
        .querySelectorAll(
            "[data-edit-stop]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        startStopEdit(
                            Number(
                                button.dataset.editStop
                            )
                        );

                    }
                );

            }
        );


    host
        .querySelectorAll(
            "[data-delete-stop]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteStop(
                            Number(
                                button.dataset.deleteStop
                            )
                        );

                    }
                );

            }
        );
}


// =========================================================
// ROUTES TABLE
// =========================================================

function renderRoutesTable() {

    const host =
        document.getElementById(
            "adminRoutesTable"
        );


    host.innerHTML =
        tableHtml(

            [
                "ID",
                "Name",
                "Number",
                "Actions"
            ],

            adminRoutes.map(
                route => [

                    route.route_id,

                    escapeHtml(
                        route.route_name
                    ),

                    escapeHtml(
                        route.route_number || "—"
                    ),

                    `

                        <div class="data-row-actions">

                            <button
                                class="btn btn-ghost btn-small"
                                data-edit-route="${route.route_id}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn btn-danger btn-small"
                                data-delete-route="${route.route_id}"
                            >
                                Delete
                            </button>

                        </div>

                    `

                ]
            )
        );


    host
        .querySelectorAll(
            "[data-edit-route]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        startRouteEdit(
                            Number(
                                button.dataset.editRoute
                            )
                        );

                    }
                );

            }
        );


    host
        .querySelectorAll(
            "[data-delete-route]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteRoute(
                            Number(
                                button.dataset.deleteRoute
                            )
                        );

                    }
                );

            }
        );
}


// =========================================================
// FARES TABLE
// =========================================================

function renderFaresTable() {

    const host =
        document.getElementById(
            "adminFaresTable"
        );


    host.innerHTML =
        tableHtml(

            [
                "ID",
                "Type",
                "From",
                "To",
                "Standard",
                "Student",
                "Actions"
            ],

            adminFares.map(
                fare => [

                    fare.fare_id,

                    escapeHtml(
                        fare.transport_type
                    ),

                    escapeHtml(
                        fare.origin_stop_name
                    ),

                    escapeHtml(
                        fare.destination_stop_name
                    ),

                    formatMoney(
                        fare.standard_fare
                    ),

                    formatMoney(
                        fare.student_fare
                    ),

                    `

                        <div class="data-row-actions">

                            <button
                                class="btn btn-ghost btn-small"
                                data-edit-fare="${fare.fare_id}"
                            >
                                Edit
                            </button>

                            <button
                                class="btn btn-danger btn-small"
                                data-delete-fare="${fare.fare_id}"
                            >
                                Delete
                            </button>

                        </div>

                    `

                ]
            )
        );


    host
        .querySelectorAll(
            "[data-edit-fare]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        startFareEdit(
                            Number(
                                button.dataset.editFare
                            )
                        );

                    }
                );

            }
        );


    host
        .querySelectorAll(
            "[data-delete-fare]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    () => {

                        deleteFare(
                            Number(
                                button.dataset.deleteFare
                            )
                        );

                    }
                );

            }
        );
}


// =========================================================
// STUDENT VERIFICATIONS
// =========================================================

function renderStudents() {

    const host =
        document.getElementById(
            "adminStudentList"
        );


    console.log(
        "Rendering students:",
        adminStudents
    );


    if (!adminStudents.length) {

        host.innerHTML = `

            <div class="empty-state">
                No student verification requests.
            </div>

        `;

        return;
    }


    host.innerHTML =
        adminStudents
            .map(
                student => `

                    <div class="data-row">

                        <span>

                            <strong>

                                ${escapeHtml(
                                    student.user_name ||
                                    "Unknown user"
                                )}

                            </strong>

                            <span>

                                ${escapeHtml(
                                    student.email ||
                                    "No email"
                                )}

                                ·

                                ${escapeHtml(
                                    student.student_id_number
                                )}

                                ·

                                ${escapeHtml(
                                    student.institution_name
                                )}

                            </span>

                            ${
                                student.id_card_url

                                ?

                                `

                                    <span>

                                        ID Card:
                                        ${escapeHtml(
                                            student.id_card_url
                                        )}

                                    </span>

                                `

                                :

                                ""
                            }

                        </span>


                        <div class="data-row-actions">

                            <span
                                class="badge ${
                                    getVerificationBadgeClass(
                                        student.verification_status
                                    )
                                }"
                            >

                                ${escapeHtml(
                                    student.verification_status
                                )}

                            </span>


                            ${
                                student.verification_status === "PENDING"

                                ?

                                `

                                    <button
                                        class="btn btn-primary btn-small"
                                        data-approve-student="${student.verification_id}"
                                    >
                                        Approve
                                    </button>

                                `

                                :

                                ""
                            }

                        </div>

                    </div>

                `
            )
            .join("");


    host
        .querySelectorAll(
            "[data-approve-student]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        try {

                            await apiRequest(

                                `/student-verifications/${button.dataset.approveStudent}/approve`,

                                {
                                    method: "PUT",
                                    auth: true
                                }

                            );


                            showToast(
                                "Student verification approved."
                            );


                            await refreshAdminData();

                        } catch (error) {

                            showToast(
                                error.message,
                                "error"
                            );

                        }

                    }
                );

            }
        );
}


// =========================================================
// COMPLAINTS
// =========================================================

function renderComplaints() {

    const host =
        document.getElementById(
            "adminComplaintList"
        );


    host.innerHTML =

        adminComplaints.length

        ?

        adminComplaints
            .map(
                complaint => `

                    <div class="data-row">

                        <span>

                            <strong>

                                ${escapeHtml(
                                    complaint.complaint_category
                                )}

                                ·

                                ${escapeHtml(
                                    complaint.user_name ||
                                    "Unknown user"
                                )}

                            </strong>

                            <span>

                                ${escapeHtml(
                                    complaint.comment
                                )}

                                ·

                                ${formatDate(
                                    complaint.created_at
                                )}

                            </span>

                        </span>


                        <div class="status-controls">

                            <span
                                class="badge ${
                                    String(
                                        complaint.status
                                    ).toLowerCase()
                                }"
                            >

                                ${escapeHtml(
                                    complaint.status
                                )}

                            </span>


                            <select
                                data-complaint-select="${complaint.feedback_id}"
                            >

                                ${
                                    [
                                        "SUBMITTED",
                                        "IN_PROGRESS",
                                        "VERIFIED"
                                    ]
                                    .map(
                                        status => `

                                            <option
                                                value="${status}"
                                                ${
                                                    status === complaint.status
                                                    ? "selected"
                                                    : ""
                                                }
                                            >
                                                ${status}
                                            </option>

                                        `
                                    )
                                    .join("")
                                }

                            </select>


                            <button
                                class="btn btn-dark btn-small"
                                data-update-complaint="${complaint.feedback_id}"
                            >
                                Update
                            </button>

                        </div>

                    </div>

                `
            )
            .join("")

        :

        `

            <div class="empty-state">
                No complaints.
            </div>

        `;


    host
        .querySelectorAll(
            "[data-update-complaint]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const feedbackId =
                            button.dataset.updateComplaint;


                        const select =
                            host.querySelector(
                                `[data-complaint-select="${feedbackId}"]`
                            );


                        try {

                            await apiRequest(

                                `/feedback/complaints/${feedbackId}/status`,

                                {
                                    method: "PATCH",

                                    auth: true,

                                    body: {
                                        status:
                                            select.value
                                    }
                                }

                            );


                            showToast(
                                "Complaint status updated."
                            );


                            await refreshAdminData();

                        } catch (error) {

                            showToast(
                                error.message,
                                "error"
                            );

                        }

                    }
                );

            }
        );
}


// =========================================================
// USERS
// =========================================================

function renderUsers() {

    document.getElementById(
        "adminUsersTable"
    ).innerHTML =

        tableHtml(

            [
                "ID",
                "Name",
                "Email",
                "Phone",
                "Role",
                "Created"
            ],

            adminUsers.map(
                user => [

                    user.user_id,

                    escapeHtml(
                        user.name
                    ),

                    escapeHtml(
                        user.email
                    ),

                    escapeHtml(
                        user.phone || "—"
                    ),

                    `

                        <span
                            class="badge ${
                                String(
                                    user.role
                                ).toLowerCase()
                            }"
                        >
                            ${escapeHtml(
                                user.role
                            )}
                        </span>

                    `,

                    formatDate(
                        user.created_at
                    )

                ]
            )
        );
}


// =========================================================
// ADMIN FORM EVENTS
// =========================================================

function wireAdminForms() {

    document.getElementById(
        "transportForm"
    ).addEventListener(
        "submit",
        submitTransport
    );


    document.getElementById(
        "transportCancelEdit"
    ).addEventListener(
        "click",
        resetTransportForm
    );


    document.getElementById(
        "stopForm"
    ).addEventListener(
        "submit",
        submitStop
    );


    document.getElementById(
        "stopCancelEdit"
    ).addEventListener(
        "click",
        resetStopForm
    );


    document.getElementById(
        "routeForm"
    ).addEventListener(
        "submit",
        submitRoute
    );


    document.getElementById(
        "routeCancelEdit"
    ).addEventListener(
        "click",
        resetRouteForm
    );


    document.getElementById(
        "fareForm"
    ).addEventListener(
        "submit",
        submitFare
    );


    document.getElementById(
        "fareCancelEdit"
    ).addEventListener(
        "click",
        resetFareForm
    );


    document.getElementById(
        "routeStopAddForm"
    ).addEventListener(
        "submit",
        submitRouteStop
    );


    document.getElementById(
        "routeStopInspectRoute"
    ).addEventListener(
        "change",
        renderAdminRouteStops
    );
}


// =========================================================
// CREATE / UPDATE TRANSPORT
// =========================================================

async function submitTransport(event) {

    event.preventDefault();


    const id =
        document.getElementById(
            "transportEditId"
        ).value;


    const body = {

        transport_type:
            document.getElementById(
                "transportType"
            ).value,

        transport_number:
            document.getElementById(
                "transportNumber"
            )
            .value
            .trim(),

        capacity:
            nullableNumber(
                document.getElementById(
                    "transportCapacity"
                ).value
            ),

        company_id:
            nullableNumber(
                document.getElementById(
                    "transportCompanyId"
                ).value
            )

    };


    try {

        await apiRequest(

            id
                ? `/transports/${id}`
                : "/transports",

            {
                method:
                    id
                        ? "PUT"
                        : "POST",

                auth: true,

                body: body
            }

        );


        showToast(
            id
                ? "Transport updated."
                : "Transport created."
        );


        resetTransportForm();

        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// START TRANSPORT EDIT
// =========================================================

function startTransportEdit(id) {

    const transport =
        adminTransports.find(
            item =>
                Number(
                    item.transport_id
                )
                ===
                Number(id)
        );


    if (!transport) {

        showToast(
            "Transport record not found.",
            "error"
        );

        return;
    }


    document.getElementById(
        "transportEditId"
    ).value =
        transport.transport_id;


    document.getElementById(
        "transportType"
    ).value =
        transport.transport_type;


    document.getElementById(
        "transportNumber"
    ).value =
        transport.transport_number;


    document.getElementById(
        "transportCapacity"
    ).value =
        transport.capacity ?? "";


    document.getElementById(
        "transportCompanyId"
    ).value =
        transport.company_id ?? "";


    document.getElementById(
        "transportSubmitButton"
    ).textContent =
        "Save transport";


    document.getElementById(
        "transportCancelEdit"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "transportForm"
    ).scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    showToast(
        `Editing transport #${transport.transport_id}`
    );
}


// =========================================================
// RESET TRANSPORT FORM
// =========================================================

function resetTransportForm() {

    document.getElementById(
        "transportForm"
    ).reset();


    document.getElementById(
        "transportEditId"
    ).value = "";


    document.getElementById(
        "transportSubmitButton"
    ).textContent =
        "Add transport";


    document.getElementById(
        "transportCancelEdit"
    ).classList.add(
        "hidden"
    );
}


// =========================================================
// DELETE TRANSPORT
// =========================================================

async function deleteTransport(id) {

    if (
        !confirm(
            `Delete transport #${id}?`
        )
    ) {
        return;
    }


    try {

        await apiRequest(

            `/transports/${id}`,

            {
                method: "DELETE",
                auth: true
            }

        );


        showToast(
            "Transport deleted."
        );


        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// CREATE / UPDATE STOP
// =========================================================

async function submitStop(event) {

    event.preventDefault();


    const id =
        document.getElementById(
            "stopEditId"
        ).value;


    const body = {

        stop_name:
            document.getElementById(
                "stopName"
            )
            .value
            .trim(),

        location:
            document.getElementById(
                "stopLocation"
            )
            .value
            .trim()
            || null,

        latitude:
            nullableNumber(
                document.getElementById(
                    "stopLatitude"
                ).value
            ),

        longitude:
            nullableNumber(
                document.getElementById(
                    "stopLongitude"
                ).value
            )

    };


    try {

        await apiRequest(

            id
                ? `/stops/${id}`
                : "/stops",

            {
                method:
                    id
                        ? "PUT"
                        : "POST",

                auth: true,

                body: body
            }

        );


        showToast(
            id
                ? "Stop updated."
                : "Stop created."
        );


        resetStopForm();

        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// START STOP EDIT
// =========================================================

function startStopEdit(id) {

    const stop =
        adminStops.find(
            item =>
                Number(
                    item.stop_id
                )
                ===
                Number(id)
        );


    if (!stop) {

        showToast(
            "Stop record not found.",
            "error"
        );

        return;
    }


    document.getElementById(
        "stopEditId"
    ).value =
        stop.stop_id;


    document.getElementById(
        "stopName"
    ).value =
        stop.stop_name;


    document.getElementById(
        "stopLocation"
    ).value =
        stop.location ?? "";


    document.getElementById(
        "stopLatitude"
    ).value =
        stop.latitude ?? "";


    document.getElementById(
        "stopLongitude"
    ).value =
        stop.longitude ?? "";


    document.getElementById(
        "stopSubmitButton"
    ).textContent =
        "Save stop";


    document.getElementById(
        "stopCancelEdit"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "stopForm"
    ).scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    showToast(
        `Editing stop #${stop.stop_id}`
    );
}


// =========================================================
// RESET STOP FORM
// =========================================================

function resetStopForm() {

    document.getElementById(
        "stopForm"
    ).reset();


    document.getElementById(
        "stopEditId"
    ).value = "";


    document.getElementById(
        "stopSubmitButton"
    ).textContent =
        "Add stop";


    document.getElementById(
        "stopCancelEdit"
    ).classList.add(
        "hidden"
    );
}


// =========================================================
// DELETE STOP
// =========================================================

async function deleteStop(id) {

    if (
        !confirm(
            `Delete stop #${id}?`
        )
    ) {
        return;
    }


    try {

        await apiRequest(

            `/stops/${id}`,

            {
                method: "DELETE",
                auth: true
            }

        );


        showToast(
            "Stop deleted."
        );


        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// CREATE / UPDATE ROUTE
// =========================================================

async function submitRoute(event) {

    event.preventDefault();


    const id =
        document.getElementById(
            "routeEditId"
        ).value;


    const body = {

        route_name:
            document.getElementById(
                "routeName"
            )
            .value
            .trim(),

        route_number:
            document.getElementById(
                "routeNumber"
            )
            .value
            .trim()
            || null

    };


    try {

        await apiRequest(

            id
                ? `/routes/${id}`
                : "/routes",

            {
                method:
                    id
                        ? "PUT"
                        : "POST",

                auth: true,

                body: body
            }

        );


        showToast(
            id
                ? "Route updated."
                : "Route created."
        );


        resetRouteForm();

        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// START ROUTE EDIT
// =========================================================

function startRouteEdit(id) {

    const route =
        adminRoutes.find(
            item =>
                Number(
                    item.route_id
                )
                ===
                Number(id)
        );


    if (!route) {

        showToast(
            "Route record not found.",
            "error"
        );

        return;
    }


    document.getElementById(
        "routeEditId"
    ).value =
        route.route_id;


    document.getElementById(
        "routeName"
    ).value =
        route.route_name;


    document.getElementById(
        "routeNumber"
    ).value =
        route.route_number ?? "";


    document.getElementById(
        "routeSubmitButton"
    ).textContent =
        "Save route";


    document.getElementById(
        "routeCancelEdit"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "routeForm"
    ).scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    showToast(
        `Editing route #${route.route_id}`
    );
}


// =========================================================
// RESET ROUTE FORM
// =========================================================

function resetRouteForm() {

    document.getElementById(
        "routeForm"
    ).reset();


    document.getElementById(
        "routeEditId"
    ).value = "";


    document.getElementById(
        "routeSubmitButton"
    ).textContent =
        "Add route";


    document.getElementById(
        "routeCancelEdit"
    ).classList.add(
        "hidden"
    );
}


// =========================================================
// DELETE ROUTE
// =========================================================

async function deleteRoute(id) {

    if (
        !confirm(
            `Delete route #${id}?`
        )
    ) {
        return;
    }


    try {

        await apiRequest(

            `/routes/${id}`,

            {
                method: "DELETE",
                auth: true
            }

        );


        showToast(
            "Route deleted."
        );


        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// CREATE / UPDATE FARE
// =========================================================

async function submitFare(event) {

    event.preventDefault();


    const id =
        document.getElementById(
            "fareEditId"
        ).value;


    const body = {

        transport_type:
            document.getElementById(
                "fareTransport"
            ).value,

        standard_fare:
            Number(
                document.getElementById(
                    "fareStandard"
                ).value
            ),

        student_fare:
            nullableNumber(
                document.getElementById(
                    "fareStudent"
                ).value
            ),

        origin_stop_id:
            Number(
                document.getElementById(
                    "fareOrigin"
                ).value
            ),

        destination_stop_id:
            Number(
                document.getElementById(
                    "fareDestination"
                ).value
            )

    };


    if (
        body.origin_stop_id
        ===
        body.destination_stop_id
    ) {

        showToast(
            "Origin and destination cannot be the same.",
            "error"
        );

        return;
    }


    try {

        await apiRequest(

            id
                ? `/fares/${id}`
                : "/fares",

            {
                method:
                    id
                        ? "PUT"
                        : "POST",

                auth: true,

                body: body
            }

        );


        showToast(
            id
                ? "Fare updated."
                : "Fare created."
        );


        resetFareForm();

        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// START FARE EDIT
// =========================================================

function startFareEdit(id) {

    const fare =
        adminFares.find(
            item =>
                Number(
                    item.fare_id
                )
                ===
                Number(id)
        );


    if (!fare) {

        showToast(
            "Fare record not found.",
            "error"
        );

        return;
    }


    document.getElementById(
        "fareEditId"
    ).value =
        fare.fare_id;


    document.getElementById(
        "fareTransport"
    ).value =
        fare.transport_type;


    document.getElementById(
        "fareStandard"
    ).value =
        fare.standard_fare;


    document.getElementById(
        "fareStudent"
    ).value =
        fare.student_fare ?? "";


    document.getElementById(
        "fareOrigin"
    ).value =
        fare.origin_stop_id;


    document.getElementById(
        "fareDestination"
    ).value =
        fare.destination_stop_id;


    document.getElementById(
        "fareSubmitButton"
    ).textContent =
        "Save fare";


    document.getElementById(
        "fareCancelEdit"
    ).classList.remove(
        "hidden"
    );


    document.getElementById(
        "fareForm"
    ).scrollIntoView({
        behavior: "smooth",
        block: "center"
    });


    showToast(
        `Editing fare #${fare.fare_id}`
    );
}


// =========================================================
// RESET FARE FORM
// =========================================================

function resetFareForm() {

    document.getElementById(
        "fareForm"
    ).reset();


    document.getElementById(
        "fareEditId"
    ).value = "";


    document.getElementById(
        "fareSubmitButton"
    ).textContent =
        "Add fare";


    document.getElementById(
        "fareCancelEdit"
    ).classList.add(
        "hidden"
    );
}


// =========================================================
// DELETE FARE
// =========================================================

async function deleteFare(id) {

    if (
        !confirm(
            `Delete fare #${id}?`
        )
    ) {
        return;
    }


    try {

        await apiRequest(

            `/fares/${id}`,

            {
                method: "DELETE",
                auth: true
            }

        );


        showToast(
            "Fare deleted."
        );


        await refreshAdminData();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// ADD STOP TO ROUTE
// =========================================================

async function submitRouteStop(event) {

    event.preventDefault();


    const routeId =
        document.getElementById(
            "routeStopRoute"
        ).value;


    const body = {

        stop_id:
            Number(
                document.getElementById(
                    "routeStopStop"
                ).value
            ),

        stop_sequence:
            Number(
                document.getElementById(
                    "routeStopSequence"
                ).value
            ),

        distance_from_previous:
            nullableNumber(
                document.getElementById(
                    "routeStopDistance"
                ).value
            )

    };


    try {

        await apiRequest(

            `/routes/${routeId}/stops`,

            {
                method: "POST",
                auth: true,
                body: body
            }

        );


        showToast(
            "Stop added to route."
        );


        document.getElementById(
            "routeStopInspectRoute"
        ).value =
            routeId;


        event.target.reset();


        await renderAdminRouteStops();

    } catch (error) {

        showToast(
            error.message,
            "error"
        );

    }
}


// =========================================================
// VIEW / REMOVE ROUTE STOPS
// =========================================================

async function renderAdminRouteStops() {

    const routeId =
        document.getElementById(
            "routeStopInspectRoute"
        ).value;


    const host =
        document.getElementById(
            "adminRouteStopsList"
        );


    if (!routeId) {

        host.innerHTML = `

            <div class="empty-state">
                Select a route to inspect its stops.
            </div>

        `;

        return;
    }


    try {

        const stops =
            await apiRequest(
                `/routes/${routeId}/stops`
            );


        host.innerHTML =

            stops.length

            ?

            stops
                .map(
                    stop => `

                        <div class="timeline-item">

                            <span
                                class="timeline-index"
                            >
                                ${stop.stop_sequence}
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


                            <button
                                class="btn btn-danger btn-small"
                                data-remove-route-stop="${stop.stop_id}"
                            >
                                Remove
                            </button>

                        </div>

                    `
                )
                .join("")

            :

            `

                <div class="empty-state">
                    No stops assigned.
                </div>

            `;


        host
            .querySelectorAll(
                "[data-remove-route-stop]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        async () => {

                            if (
                                !confirm(
                                    "Remove this stop from the route?"
                                )
                            ) {
                                return;
                            }


                            try {

                                await apiRequest(

                                    `/routes/${routeId}/stops/${button.dataset.removeRouteStop}`,

                                    {
                                        method: "DELETE",
                                        auth: true
                                    }

                                );


                                showToast(
                                    "Stop removed from route."
                                );


                                await renderAdminRouteStops();

                            } catch (error) {

                                showToast(
                                    error.message,
                                    "error"
                                );

                            }

                        }
                    );

                }
            );

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