create table if not exists personal_apps (
    id                integer generated always as identity primary key,
    name              text not null,
    description       text,
    category          text,
    s3_key            text not null,
    original_filename text not null,
    file_size         integer not null,
    uploader_email    text not null,
    uploaded_at       timestamptz not null default now()
);
