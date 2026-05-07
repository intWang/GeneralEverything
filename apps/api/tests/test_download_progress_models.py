from app.services.downloads.progress import (
    DownloadDiagnostic,
    DownloadFormatChoice,
    DownloadProgress,
)


def test_download_progress_serializes_known_fields():
    progress = DownloadProgress(
        status="downloading",
        percent=42,
        downloaded_bytes=4_200,
        total_bytes=10_000,
        speed_bytes_per_second=512,
        eta_seconds=12,
    )

    assert progress.model_dump() == {
        "status": "downloading",
        "percent": 42,
        "downloaded_bytes": 4200,
        "total_bytes": 10000,
        "speed_bytes_per_second": 512,
        "eta_seconds": 12,
    }


def test_format_choice_and_diagnostic_are_safe_to_expose():
    format_choice = DownloadFormatChoice(
        format_id="rc-best",
        format_label="RingCentral recording stream",
        resolution="source",
        container="mp4",
        kind="video",
    )
    diagnostic = DownloadDiagnostic(
        reason="ringcentral_auth_required",
        stage="metadata_probe",
        message="This RingCentral recording requires a signed-in session.",
        suggestion="Open the recording in your browser, then retry with a fresh shared link.",
    )

    assert format_choice.model_dump()["format_id"] == "rc-best"
    assert "signed-in" in diagnostic.model_dump()["message"]
