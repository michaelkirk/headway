apiVersion: apps/v1
kind: Deployment
metadata:
  name: headway-opentripplanner-deployment
spec:
  selector:
    matchLabels:
      app: opentripplanner
  replicas: 1
  template:
    metadata:
      labels:
        app: opentripplanner
    spec:
      initContainers:
        - name: opentripplanner-init
          image: ghcr.io/headwaymaps/opentripplanner-init:${HEADWAY_VERSION}
          imagePullPolicy: Always
          volumeMounts:
            - name: opentripplanner-volume
              mountPath: /data
          env:
            - name: OTP_ARTIFACT_URL
              valueFrom:
                configMapKeyRef:
                  name: deployment-config
                  key: otp-graph-url
          resources:
            limits:
              memory: 128Mi
            requests:
              memory: 128Mi
      containers:
        - name: opentripplanner
          image: ghcr.io/headwaymaps/opentripplanner:${HEADWAY_VERSION}
          imagePullPolicy: Always
          ports:
            - containerPort: 8080
          volumeMounts:
            - name: opentripplanner-volume
              mountPath: /data
          resources:
            limits:
              memory: 4.5Gi
          livenessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 15
            failureThreshold: 10
          readinessProbe:
            httpGet:
              path: /
              port: 8080
            initialDelaySeconds: 15
            periodSeconds: 15
            failureThreshold: 10
      volumes:
        - name: opentripplanner-volume
          ephemeral:
            volumeClaimTemplate:
              spec:
                accessModes: [ "ReadWriteOnce" ]
                resources:
                  requests:
                    storage: 1Gi
