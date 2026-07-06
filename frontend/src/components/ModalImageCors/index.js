import React, { useState, useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";

import ModalImage from "react-modal-image";
import api from "../../services/api";

const useStyles = makeStyles(theme => ({
	messageMedia: {
		objectFit: "cover",
		width: 250,
		height: 200,
		borderTopLeftRadius: 8,
		borderTopRightRadius: 8,
		borderBottomLeftRadius: 8,
		borderBottomRightRadius: 8,
	},
}));

const ModalImageCors = ({ imageUrl }) => {
	const classes = useStyles();
	const [fetching, setFetching] = useState(true);
	const [blobUrl, setBlobUrl] = useState("");

	useEffect(() => {
		if (!imageUrl) return;

		// URL absoluta (ex: R2) já é pública — usa direto, sem fetch via XHR
		// (evita depender de CORS estar configurado no bucket)
		if (imageUrl.startsWith("http")) {
			setBlobUrl(imageUrl);
			setFetching(false);
			return;
		}

		const fetchImage = async () => {
			try {
				const { data, headers } = await api.get(imageUrl, {
					responseType: "blob",
				});
				const url = window.URL.createObjectURL(
					new Blob([data], { type: headers["content-type"] })
				);
				setBlobUrl(url);
				setFetching(false);
			} catch (err) {
				console.error("Erro ao carregar imagem CORS:", err);
				setFetching(false);
			}
		};
		fetchImage();
	}, [imageUrl]);

	return (
		<ModalImage
			className={classes.messageMedia}
			smallSrcSet={fetching ? imageUrl : blobUrl}
			medium={fetching ? imageUrl : blobUrl}
			large={fetching ? imageUrl : blobUrl}
			alt="image"
		/>
	);
};

export default ModalImageCors;
